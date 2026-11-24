import { NotificationType } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { sendPaymentReceiptEmail } from "../user/mail.service.js";
import { NotificationService } from "../notification/notification.service.js"; // adjust path if needed

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
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

type PaymentVoidNotify = {
  id: string;
  amount: number;
  receipt: string;
  paidAt: Date;
  userId: string;
  voidReason?: string | null;
};

type DueCreatedInfo = {
  title: string;
  amount: number;
  dueDate?: Date | string | null;
  categoryName?: string;
  year?: number;
  month?: number;
};

type DueWaivedInfo = {
  id: string;
  userId: string;
  title: string | null;
  amount: number;
  note?: string | null;
};

// ─────────────────────────────────────────────────────────────
// Payment Received (in-app + email)
// ─────────────────────────────────────────────────────────────
/**
 * Notify a member that a payment was recorded for them.
 * Never throws.
 */
export async function notifyPaymentReceived(p: PaymentForNotify): Promise<void> {
  try {
    const [user, prefs, dueRow] = await Promise.all([
      prisma.user.findUnique({
        where: { id: p.user.id },
        select: { id: true, name: true, email: true },
      }),
      prisma.notificationPreference.findUnique({
        where: { userId: p.user.id },
        select: { emailEnabled: true },
      }),
      p.dueId
        ? prisma.due.findUnique({
            where: { id: p.dueId },
            select: { amount: true, paidAmount: true },
          })
        : null,
    ]);

    if (!user) return;

    const emailEnabled = prefs?.emailEnabled ?? true;

    const dueLabel = p.due
      ? p.due.title ||
        (p.due.year && p.due.month
          ? `${MONTHS[p.due.month - 1]} ${p.due.year}`
          : p.category.name)
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
      NotificationService.notifySafe({
        userId: user.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: "Payment Received",
        body:
          `৳${p.amount.toLocaleString("en-BD")} received for ${dueLabel ?? p.category.name}. ` +
          `Receipt ${p.receipt}.` +
          (due
            ? due.remaining > 0
              ? ` ৳${due.remaining.toLocaleString("en-BD")} still due.`
              : " Fully paid."
            : ""),
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

// ─────────────────────────────────────────────────────────────
// Payment Voided
// ─────────────────────────────────────────────────────────────
export async function notifyPaymentVoided(p: PaymentVoidNotify): Promise<void> {
  try {
    await NotificationService.notifySafe({
      userId: p.userId,
      type: NotificationType.SYSTEM,
      title: "Payment Voided",
      body: `Your payment of ৳${p.amount.toLocaleString("en-BD")} (Receipt: ${p.receipt}) has been voided.${
        p.voidReason ? ` Reason: ${p.voidReason}` : ""
      }`,
      entityType: "PAYMENT",
      entityId: p.id,
      metadata: {
        amount: p.amount,
        receipt: p.receipt,
        voidReason: p.voidReason ?? null,
      },
    });
  } catch (err) {
    console.error("[notifyPaymentVoided]", err);
  }
}

// ─────────────────────────────────────────────────────────────
// New Dues Created (bulk / monthly)
// ─────────────────────────────────────────────────────────────
export async function notifyDuesCreated(
  userIds: string[],
  info: DueCreatedInfo
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const amountStr = `৳${info.amount.toLocaleString("en-BD")}`;
    const dueDateStr = info.dueDate
      ? new Date(info.dueDate).toLocaleDateString("en-GB")
      : null;

    let body = `A new due of ${amountStr} has been assigned`;
    if (info.categoryName) body += ` for ${info.categoryName}`;
    if (info.year && info.month) {
      body += ` (${MONTHS[info.month - 1]} ${info.year})`;
    }
    if (dueDateStr) body += `. Due by ${dueDateStr}.`;

    await NotificationService.notifyManySafe(userIds, {
      type: NotificationType.SYSTEM,
      title: "New Due Assigned",
      body,
      entityType: "DUE",
      metadata: {
        amount: info.amount,
        title: info.title,
        category: info.categoryName,
        year: info.year,
        month: info.month,
        dueDate: info.dueDate,
      },
    });
  } catch (err) {
    console.error("[notifyDuesCreated]", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Due Waived
// ─────────────────────────────────────────────────────────────
export async function notifyDueWaived(due: DueWaivedInfo): Promise<void> {
  try {
    await NotificationService.notifySafe({
      userId: due.userId,
      type: NotificationType.SYSTEM,
      title: "Due Waived",
      body: `Your due "${due.title || "Untitled"}" of ৳${due.amount.toLocaleString(
        "en-BD"
      )} has been waived.${due.note ? ` Note: ${due.note}` : ""}`,
      entityType: "DUE",
      entityId: due.id,
      metadata: {
        amount: due.amount,
        note: due.note ?? null,
      },
    });
  } catch (err) {
    console.error("[notifyDueWaived]", err);
  }
}