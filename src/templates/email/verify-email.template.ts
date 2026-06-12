import { renderBaseLayout } from "./layouts/base.layout";

/**
 * Email verification template — sent when a member registers and needs to
 * confirm ownership of the address they provided.
 *
 * Issue 013 only prepares the template infrastructure. The token store
 * and verification flow (issue 015) will populate `verifyUrl` and
 * `expiresInMinutes` from a real source; this template renders whichever
 * values the caller passes and stays compatible with both link-based
 * and code-based verification flows.
 */

export interface VerifyEmailTemplateOptions {
  memberName: string;
  verifyUrl?: string;
  /** Human-readable expiry window, e.g. "24 jam". */
  expiresInHours?: number | string;
  appName?: string;
  appUrl?: string;
}

const DEFAULT_APP_NAME = "CusCuciin";
const DEFAULT_EXPIRY = "24 jam";

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
  if (typeof value === "number") return `${value} jam`;
  return String(value);
}

export function renderVerifyEmail(
  options: VerifyEmailTemplateOptions
): { subject: string; html: string; text: string } {
  const appName = options.appName || DEFAULT_APP_NAME;
  const memberName = escape(options.memberName || "Pelanggan");
  const verifyUrl = options.verifyUrl?.trim() || "";
  const expires = escape(formatExpiry(options.expiresInHours));

  const cta = verifyUrl
    ? `<p style="margin:24px 0;text-align:center;">
         <a href="${escape(verifyUrl)}" style="display:inline-block;padding:12px 20px;background-color:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Verifikasi email saya</a>
       </p>`
    : "";

  const content = `
    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;">Verifikasi alamat email</h1>
    <p style="margin:0 0 16px 0;">Halo ${memberName},</p>
    <p style="margin:0 0 16px 0;">Terima kasih telah mendaftar di <strong>${escape(appName)}</strong>. Untuk mengaktifkan akun Anda, mohon konfirmasi bahwa email ini adalah milik Anda.</p>
    ${cta}
    <p style="margin:16px 0;">Tautan verifikasi ini akan kedaluwarsa dalam <strong>${expires}</strong>.</p>
    <p style="margin:16px 0 0 0;">Jika Anda tidak merasa mendaftar untuk akun ini, abaikan email ini.</p>
  `;

  const html = renderBaseLayout({
    appName,
    appUrl: options.appUrl,
    content,
  });

  const text = [
    `Halo ${options.memberName || "Pelanggan"},`,
    "",
    `Terima kasih telah mendaftar di ${appName}. Untuk mengaktifkan akun Anda, mohon konfirmasi alamat email Anda.`,
    verifyUrl ? `Verifikasi email: ${verifyUrl}` : "",
    `Tautan ini kedaluwarsa dalam ${formatExpiry(options.expiresInHours)}.`,
    "",
    "Jika Anda tidak merasa mendaftar untuk akun ini, abaikan email ini.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Verifikasi email Anda untuk ${appName}`,
    html,
    text,
  };
}