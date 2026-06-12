import logger from "../../configs/logger.config";
import { getProvider, getAllProviders } from "./providers";
import type {
  EmailAddressObject,
  EmailLogEvent,
  EmailProvider,
  EmailRecipient,
} from "./email.types";

/**
 * Resolve the "from" address for a provider, falling back to the
 * developer-mailbox if the provider-specific value is not configured.
 *
 * Kept here (not in vars.config) so the email service owns its own
 * provider-to-identity mapping. Business code never needs to know which
 * email address is associated with which provider.
 */
export function fromAddressFor(provider: EmailProvider): string {
  if (provider === "auto") {
    const first = getAllProviders().values().next();
    return first.done ? "" : first.value.getDefaultFrom();
  }
  const emailProvider = getProvider(provider);
  return emailProvider?.getDefaultFrom() || "";
}

/**
 * Coerce a Nodemailer recipient (string | Address | array of either)
 * into a single comma-joined string suitable for log output. The
 * `Address` form (`{ name, address }`) is normalised to its address.
 */
export function recipientToString(
  value: EmailRecipient | undefined
): string {
  if (!value) return "";
  const norm = (v: string | EmailAddressObject): string =>
    typeof v === "string" ? v : v.address || "";
  if (Array.isArray(value)) return value.map(norm).filter(Boolean).join(", ");
  return norm(value);
}

/**
 * Centralised email event logging. All log lines are prefixed `[EMAIL]`
 * so they are easy to grep in production logs and so the email subsystem
 * is identifiable at a glance, matching the pattern used elsewhere in
 * the codebase (`[SERVER]`, `[SESSION]`, `[PRISMA]`, etc.).
 */
export function logEmailEvent(
  event: EmailLogEvent,
  context?: {
    to?: EmailRecipient;
    subject?: string;
  }
): void {
  const to = recipientToString(context?.to);
  const subject = context?.subject ?? "";

  switch (event.kind) {
    case "email.sent":
      logger.info(
        `[EMAIL] email.sent provider=${event.provider} to=${event.to || to} subject="${event.subject || subject}" messageId=${event.messageId}`
      );
      break;
    case "email.failed":
      logger.error(
        `[EMAIL] email.failed provider=${event.provider} to=${event.to || to} subject="${event.subject || subject}" error=${event.error}`
      );
      break;
    case "email.fallback":
      logger.warn(
        `[EMAIL] email.fallback from=${event.from} to=${event.to} originalError=${event.originalError}`
      );
      break;
    case "email.provider":
      if (event.action === "selected") {
        logger.info(
          `[EMAIL] email.provider selected=${event.provider}${event.reason ? ` reason=${event.reason}` : ""}`
        );
      } else {
        logger.warn(
          `[EMAIL] email.provider skipped=${event.provider}${event.reason ? ` reason=${event.reason}` : ""}`
        );
      }
      break;
    default: {
      // Exhaustiveness check — TypeScript will flag a missing case here
      // if EmailLogEvent gains a new variant.
      const _exhaustive: never = event;
      void _exhaustive;
    }
  }
}
