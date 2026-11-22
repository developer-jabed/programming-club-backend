import { Resend } from "resend";

// Put these in your .env (never hardcode the key):
//   RESEND_API_KEY=re_xxxxxxxx
//   EMAIL_FROM="DPI Programming Club <noreply@yourdomain.com>"
//   FRONTEND_URL=https://programming-club-frontend.vercel.app
const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://programming-club-frontend.vercel.app";

// Prevents HTML injection through names / passwords inside the email
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface WelcomeEmailPayload {
  name: string;
  email: string;
  password: string; // plain password, only used for this email
}

const buildWelcomeHtml = ({ name, email, password }: WelcomeEmailPayload) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
  <h2 style="margin:0 0 8px;color:#4f46e5;">Welcome to DPI Programming Club 🎉</h2>
  <p style="margin:0 0 16px;">Hi <strong>${escapeHtml(name)}</strong>,</p>
  <p style="margin:0 0 16px;">Your account has been created. Use the details below to log in to the website:</p>
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

/**
 * Sends the welcome email. Never throws: a mail problem must not break user creation.
 * Returns true when Resend accepted the email.
 */
export const sendWelcomeEmail = async (
  payload: WelcomeEmailPayload
): Promise<boolean> => {
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: payload.email,
      subject: `Welcome to DPI Programming Club, ${payload.name}!`,
      html: buildWelcomeHtml(payload),
      text:
        `Welcome to DPI Programming Club, ${payload.name}!\n\n` +
        `Website: ${FRONTEND_URL}\n` +
        `User ID: ${payload.email}\n` +
        `Password: ${payload.password}\n\n` +
        `Please change your password after your first login.`,
    });

    if (error) {
      console.error("[mail] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] Failed to send welcome email:", err);
    return false;
  }
};