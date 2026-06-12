import { renderBaseLayout } from "./layouts/base.layout";

/**
 * Password reset email — sent when a member requests a password reset.
 *
 * Issue 013 only prepares the template infrastructure. The reset-token
 * flow (issue 014) will populate `resetUrl` and `expiresInMinutes` from
 * a real token store; this template renders whichever values the caller
 * passes and stays compatible with both time-limited URLs and
 * one-time-code flows.
 */

export interface PasswordResetTemplateOptions {
  memberName: string;
  resetUrl?: string;
  /** Human-readable expiry window, e.g. "30 menit". */
  expiresInMinutes?: number | string;
  appName?: string;
  appUrl?: string;
}

const DEFAULT_APP_NAME = "CusCuciin";
const DEFAULT_EXPIRY = "30 menit";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(value: number | string | undefined): string {
  if (value === undefined || value === null) return DEFAULT_EXPIRY;
  if (typeof value === "number") return `${value} menit`;
  return String(value);
}

export function renderPasswordResetEmail(
  options: PasswordResetTemplateOptions
): { subject: string; html: string; text: string } {
  const appName = options.appName || DEFAULT_APP_NAME;
  const memberName = escape(options.memberName || "Pelanggan");
  const resetUrl = options.resetUrl?.trim() || "";
  const expires = escape(formatExpiry(options.expiresInMinutes));

  const cta = resetUrl
    ? `<p style="margin:24px 0;text-align:center;">
         <a href="${escape(resetUrl)}" style="display:inline-block;padding:12px 20px;background-color:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Atur ulang kata sandi</a>
       </p>`
    : "";

  const content = `
    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;">Reset kata sandi</h1>
    <p style="margin:0 0 16px 0;">Halo ${memberName},</p>
    <p style="margin:0 0 16px 0;">Kami menerima permintaan untuk mengatur ulang kata sandi akun <strong>${escape(appName)}</strong> Anda. Jika Anda yang meminta, klik tombol di bawah ini untuk melanjutkan.</p>
    ${cta}
    <p style="margin:16px 0;">Tautan ini akan kedaluwarsa dalam <strong>${expires}</strong> dan hanya dapat digunakan satu kali.</p>
    <p style="margin:16px 0 0 0;">Jika Anda tidak meminta reset kata sandi, abaikan email ini. Kata sandi Anda saat ini tetap aman.</p>
  `;

  const html = renderBaseLayout({
    appName,
    appUrl: options.appUrl,
    content,
  });

  const text = [
    `Halo ${options.memberName || "Pelanggan"},`,
    "",
    `Kami menerima permintaan reset kata sandi untuk akun ${appName} Anda.`,
    resetUrl ? `Atur ulang kata sandi: ${resetUrl}` : "",
    `Tautan ini kedaluwarsa dalam ${formatExpiry(options.expiresInMinutes)}.`,
    "",
    "Jika Anda tidak meminta reset kata sandi, abaikan email ini.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Reset kata sandi ${appName}`,
    html,
    text,
  };
}