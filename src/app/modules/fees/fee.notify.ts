import { NotificationType } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { sendPaymentReceiptEmail } from "../user/mail.service.js";
import { NotificationService } from "../notification/notification.service.js"; // adjust path if different

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type PaymentForNotify = {
  id: string;
  receipt: string;
  amount: number;
  paidAt: Date;
  note: string | null;
  dueId: string | null;
  user: { id: string; name: string };
  category: { name: string };
  due: { year: number | null; month: number | null; title: string | null } | null;
};

/**
 * Notify a member that a payment was recorded for them:
 *  - in-app notification (via NotificationService, which already honours inAppEnabled)
 *  - receipt email (if emailEnabled and the user has an email)
 *
 * Never throws: a notification failure must not affect the payment itself.
 */
export async function notifyPaymentReceived(p: PaymentForNotify): Promise<void> {
  try {
    const [user, prefs, dueRow] = await Promise.all([
      prisma.user.findUnique({ where: { id: p.user.id }, select: { id: true, name: true, email: true } }),
      prisma.notificationPreference.findUnique({
        where: { userId: p.user.id },
        select: { emailEnabled: true },
      }),
      p.dueId
        ? prisma.due.findUnique({ where: { id: p.dueId }, select: { amount: true, paidAmount: true } })
        : null,
    ]);
    if (!user) return;

    // No preference row yet → defaults to enabled
    const emailEnabled = prefs?.emailEnabled ?? true;

    const dueLabel = p.due
      ? p.due.title || (p.due.year && p.due.month ? `${MONTHS[p.due.month - 1]} ${p.due.year}` : p.category.name)
      : null;

    const due =
      dueRow && dueLabel
        ? {
            label: dueLabel,
            totalAmount: dueRow.amount,
            paidAmount: dueRow.paidAmount,
            remaining: Math.max(0, dueRow.amount - dueRow.paidAmount),
          }
        : null;

    const tasks: Promise<unknown>[] = [
      // notifySafe checks inAppEnabled itself and never throws
      NotificationService.notifySafe({
        userId: user.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Payment received",
        body:
          `৳${p.amount.toLocaleString("en-BD")} received for ${dueLabel ?? p.category.name}. ` +
          `Receipt ${p.receipt}.` +
          (due ? (due.remaining > 0 ? ` ৳${due.remaining.toLocaleString("en-BD")} still due.` : " Fully paid.") : ""),
        entityType: "PAYMENT",
        entityId: p.id,
        metadata: {
          receipt: p.receipt,
          amount: p.amount,
          categoryName: p.category.name,
          dueId: p.dueId,
          remaining: due?.remaining ?? null,
        },
      }),
    ];

    if (emailEnabled && user.email) {
      tasks.push(
        sendPaymentReceiptEmail({
          name: user.name,
          email: user.email,
          receipt: p.receipt,
          amount: p.amount,
          category: p.category.name,
          paidAt: p.paidAt,
          note: p.note,
          due,
        })
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[notifyPaymentReceived]", err);
  }
}