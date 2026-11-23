const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://programming-club-frontend.vercel.app";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface SendMailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/* ─────────────────────────────────────────────────────────────
 * Shared Brevo sender (used by every email below)
 * ───────────────────────────────────────────────────────────── */
interface BrevoMail {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  tag: string; // only used for log lines
}

const sendBrevoMail = async ({ to, subject, html, text, tag }: BrevoMail): Promise<SendMailResult> => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[mail] BREVO_API_KEY is not set");
    return { sent: false, error: "BREVO_API_KEY is not set" };
  }

  console.log(`[mail] Sending ${tag} email to ${to.email}`);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "DPI Programming Club",
          email: "programmingclub09@gmail.com", // must be verified in Brevo
        },
        to: [to],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[mail] ${tag} FAILED (${res.status}):`, data);
      return { sent: false, error: data?.message || `Brevo responded with ${res.status}` };
    }

    console.log(`[mail] ${tag} SENT to ${to.email}`);
    return { sent: true, id: data?.messageId };
  } catch (err: any) {
    console.error(`[mail] ${tag} FAILED:`, err?.message || err);
    return { sent: false, error: err?.message || "Unknown error" };
  }
};

/* ─────────────────────────────────────────────────────────────
 * Welcome email (unchanged behaviour)
 * ───────────────────────────────────────────────────────────── */
interface WelcomeEmailPayload {
  name: string;
  email: string;
  password: string;
}

const buildWelcomeHtml = ({ name, email, password }: WelcomeEmailPayload) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <h2 style="margin:0 0 8px;color:#4f46e5;">Welcome to DPI Programming Club 🎉</h2>
  <p style="margin:0 0 16px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
  <p style="margin:0 0 16px;">Your account has been created. Use the details below to log in:</p>
  <table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:8px;">
    <tr>
      <td style="padding:12px 16px;color:#6b7280;width:120px;">User ID</td>
      <td style="padding:12px 16px;"><strong>${escapeHtml(email)}</strong></td>
    </tr>
    <tr>
      <td style="padding:12px 16px;color:#6b7280;">Password</td>
      <td style="padding:12px 16px;"><strong>${escapeHtml(password)}</strong></td>
    </tr>
  </table>
  <p style="margin:24px 0;">
    <a href="${FRONTEND_URL}"
       style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
      Open Website
    </a>
  </p>
  <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Website: ${FRONTEND_URL}</p>
  <p style="margin:0;color:#6b7280;font-size:13px;">Please keep your password safe and change it after your first login.</p>
</div>`;

export const sendWelcomeEmail = (payload: WelcomeEmailPayload): Promise<SendMailResult> =>
  sendBrevoMail({
    tag: "welcome",
    to: { email: payload.email, name: payload.name },
    subject: `Welcome to DPI Programming Club, ${payload.name}!`,
    html: buildWelcomeHtml(payload),
    text:
      `Welcome to DPI Programming Club, ${payload.name}!\n\n` +
      `Website: ${FRONTEND_URL}\n` +
      `User ID: ${payload.email}\n` +
      `Password: ${payload.password}\n\n` +
      `Please change your password after your first login.`,
  });

/* ─────────────────────────────────────────────────────────────
 * Payment receipt email
 * ───────────────────────────────────────────────────────────── */
export interface PaymentReceiptPayload {
  name: string;
  email: string;
  receipt: string; // e.g. PC-2026-000042
  amount: number;
  category: string;
  paidAt: Date;
  note?: string | null;
  /** Only when the payment was applied to a due */
  due?: { label: string; totalAmount: number; paidAmount: number; remaining: number } | null;
}

const money = (n: number) => `৳${n.toLocaleString("en-BD")}`;
const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 16px;color:#6b7280;width:140px;">${label}</td>
      <td style="padding:10px 16px;"><strong>${value}</strong></td>
    </tr>`;

const buildReceiptHtml = (p: PaymentReceiptPayload) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <h2 style="margin:0 0 8px;color:#059669;">Payment received ✅</h2>
  <p style="margin:0 0 16px;">Hi <strong>${escapeHtml(p.name)}</strong>,</p>
  <p style="margin:0 0 16px;">We've received your payment. Here is your receipt:</p>
  <table style="width:100%;border-collapse:collapse;background:#f3f4f6;border-radius:8px;">
    ${row("Receipt no.", escapeHtml(p.receipt))}
    ${row("Amount", escapeHtml(money(p.amount)))}
    ${row("For", escapeHtml(p.category))}
    ${row("Date", escapeHtml(fmtDate(p.paidAt)))}
    ${p.due ? row("Due", escapeHtml(p.due.label)) : ""}
    ${
      p.due
        ? row(
            "Due status",
            p.due.remaining > 0
              ? `${escapeHtml(money(p.due.remaining))} remaining`
              : "Fully paid"
          )
        : ""
    }
    ${p.note ? row("Note", escapeHtml(p.note)) : ""}
  </table>
  <p style="margin:24px 0;">
    <a href="${FRONTEND_URL}"
       style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
      View my payments
    </a>
  </p>
  <p style="margin:0;color:#6b7280;font-size:13px;">Keep this email as your receipt. If anything looks wrong, contact the club admin.</p>
</div>`;

export const sendPaymentReceiptEmail = (p: PaymentReceiptPayload): Promise<SendMailResult> =>
  sendBrevoMail({
    tag: "payment-receipt",
    to: { email: p.email, name: p.name },
    subject: `Payment received – ${p.receipt}`,
    html: buildReceiptHtml(p),
    text:
      `Hi ${p.name},\n\nWe've received your payment.\n\n` +
      `Receipt no.: ${p.receipt}\n` +
      `Amount: ${money(p.amount)}\n` +
      `For: ${p.category}\n` +
      `Date: ${fmtDate(p.paidAt)}\n` +
      (p.due
        ? `Due: ${p.due.label} (${p.due.remaining > 0 ? `${money(p.due.remaining)} remaining` : "fully paid"})\n`
        : "") +
      (p.note ? `Note: ${p.note}\n` : "") +
      `\nWebsite: ${FRONTEND_URL}`,
  });