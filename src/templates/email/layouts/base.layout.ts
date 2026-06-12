/**
 * Shared base layout for all transactional emails.
 *
 * Renders the supplied `content` inside a table-based HTML shell that is
 * reasonably safe across email clients (Outlook, Gmail web, Apple Mail).
 * Inline styles are used because most clients strip `<style>` blocks.
 *
 * The layout intentionally avoids external assets (no remote images, no
 * web fonts, no external CSS) so it works in clients that block remote
 * content by default and so the email is fully self-contained.
 */

export interface BaseLayoutOptions {
  /** Pre-rendered HTML body of the email (already-escaped). */
  content: string;
  /** Brand / app name shown in the header and footer. */
  appName: string;
  /** Public URL of the application — used in the footer link. */
  appUrl?: string;
  /** Optional year override; defaults to current UTC year. */
  year?: number;
}

const BRAND_PRIMARY = "#1d4ed8"; // tailwind blue-700
const BRAND_TEXT = "#0f172a"; // slate-900
const BRAND_MUTED = "#64748b"; // slate-500
const BRAND_BG = "#f8fafc"; // slate-50
const BRAND_BORDER = "#e2e8f0"; // slate-200

export function renderBaseLayout(options: BaseLayoutOptions): string {
  const year = options.year ?? new Date().getUTCFullYear();
  const appName = escapeHtml(options.appName || "CusCuciin");
  const appUrl = options.appUrl
    ? `<a href="${escapeAttr(options.appUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none">${escapeHtml(options.appUrl)}</a>`
    : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title></title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_TEXT};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND_BG};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;background-color:${BRAND_PRIMARY};color:#ffffff;font-size:18px;font-weight:600;">
                ${appName}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:15px;line-height:1.55;">
                ${options.content}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:${BRAND_BG};color:${BRAND_MUTED};font-size:12px;line-height:1.5;border-top:1px solid ${BRAND_BORDER};">
                &copy; ${year} ${appName}.${appUrl ? ` &middot; ${appUrl}` : ""}<br />
                Email ini dikirim secara otomatis. Mohon tidak membalas langsung.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Minimal HTML escape for user-supplied text that will be interpolated
 * into the layout. Email content is expected to be authored by us, but
 * the layout is a shared utility and we treat all interpolations as
 * untrusted to keep the escape function close to the render path.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
