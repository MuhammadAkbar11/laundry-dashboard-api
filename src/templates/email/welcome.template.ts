import { renderBaseLayout } from "./layouts/base.layout";

/**
 * Welcome email — sent after a new member successfully registers.
 *
 * The token flow (email verification, password reset) is not implemented
 * here; issue 013 only prepares the template infrastructure. Callers
 * will pass an `actionUrl` once those flows land.
 */

export interface WelcomeTemplateOptions {
  memberName: string;
  appName?: string;
  appUrl?: string;
  /** Optional CTA URL — e.g. link to the storefront or to verify email. */
  actionUrl?: string;
  actionLabel?: string;
}

const DEFAULT_APP_NAME = "CusCuciin";
const DEFAULT_ACTION_LABEL = "Buka dashboard member";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderWelcomeEmail(options: WelcomeTemplateOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const appName = options.appName || DEFAULT_APP_NAME;
  const memberName = escape(options.memberName || "Pelanggan");
  const actionUrl = options.actionUrl?.trim() || "";
  const actionLabel = escape(options.actionLabel || DEFAULT_ACTION_LABEL);

  const content = `
    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;">Selamat datang, ${memberName}!</h1>
    <p style="margin:0 0 16px 0;">Terima kasih telah mendaftar di <strong>${escape(appName)}</strong>. Akun Anda sudah aktif dan siap digunakan.</p>
    <p style="margin:0 0 16px 0;">Melalui dashboard member, Anda dapat:</p>
    <ul style="margin:0 0 16px 0;padding-left:20px;">
      <li>Melihat dan mengelola pesanan laundry Anda.</li>
      <li>Memperbarui profil dan informasi kontak.</li>
      <li>Mengakses riwayat transaksi dan bukti pembayaran.</li>
    </ul>
    ${
      actionUrl
        ? `<p style="margin:24px 0;text-align:center;">
              <a href="${escape(actionUrl)}" style="display:inline-block;padding:12px 20px;background-color:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${actionLabel}</a>
            </p>`
        : ""
    }
    <p style="margin:16px 0 0 0;">Jika Anda merasa tidak mendaftar untuk akun ini, abaikan email ini.</p>
  `;

  const html = renderBaseLayout({
    appName,
    appUrl: options.appUrl,
    content,
  });

  const text = [
    `Selamat datang, ${options.memberName || "Pelanggan"}!`,
    "",
    `Terima kasih telah mendaftar di ${appName}. Akun Anda sudah aktif.`,
    "",
    actionUrl ? `${actionLabel}: ${actionUrl}` : "",
    "",
    "Jika Anda merasa tidak mendaftar untuk akun ini, abaikan email ini.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Selamat datang di ${appName}`,
    html,
    text,
  };
}