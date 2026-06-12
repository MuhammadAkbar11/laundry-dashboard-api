import type { SendMailOptions } from "nodemailer";

/**
 * Supported email providers.
 *
 * - "gmail"    — Gmail OAuth2 transporter (primary).
 * - "zohomail" — ZohoMail SMTP transporter (legacy, retained for the
 *                 developer-notification flow that pre-dates the failover
 *                 infrastructure introduced in issue 013).
 * - "auto"     — Try providers in failover order (currently Gmail first).
 *
 * New providers are added by implementing `IEmailProvider` and
 * registering the instance with the provider registry. The union
 * type is intentionally kept broad (`string & {}`) so it stays in
 * sync with the registry without requiring a type-level update for
 * every new provider.
 */
export type EmailProvider = "gmail" | "zohomail" | "auto" | (string & {});

/**
 * The set of providers that `auto` mode is allowed to try, in order.
 * Anything not in this list is excluded from failover so a legacy
 * call cannot accidentally become part of an auto chain.
 */
export const AUTO_FAILOVER_ORDER: ReadonlyArray<"gmail" | "zohomail"> = [
  "gmail",
  "zohomail",
];

/**
 * Nodemailer's structured address form. Inlined here (the `Address`
 * type is not exported by the public typings of the `nodemailer`
 * runtime module) so the rest of the service has a stable, named
 * alias. Matches `{ name: string; address: string }` exactly so the
 * shape is assignable to Nodemailer's internal `Address` type — an
 * optional `name` is not structurally compatible with the upstream
 * definition.
 */
export interface EmailAddressObject {
  name: string;
  address: string;
}

/**
 * Recipient shape accepted by Nodemailer. We keep the wide type so
 * business code can pass either plain addresses or `{ name, address }`
 * objects without a conversion.
 */
export type EmailRecipient = string | EmailAddressObject | (string | EmailAddressObject)[];

/**
 * Public-facing email options accepted by EmailService. Mirrors the subset
 * of Nodemailer's SendMailOptions that the application actually uses.
 */
export type EmailOptions = Pick<
  SendMailOptions,
  "subject" | "text" | "html" | "attachments"
> & {
  to?: EmailRecipient;
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/**
 * Result of a send attempt. Records the provider that actually delivered
 * the message (or the last one tried if every provider failed).
 */
export interface EmailSendResult {
  provider: EmailProvider;
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
  attempts: Array<{
    provider: string;
    ok: boolean;
    error?: string;
  }>;
}

/**
 * Discriminated union for email logging events. Used by the email logger
 * to keep log shape consistent across send / fail / fallback / provider.
 */
export type EmailLogEvent =
  | { kind: "email.sent"; provider: EmailProvider; to: string; subject: string; messageId: string }
  | { kind: "email.failed"; provider: EmailProvider; to: string; subject: string; error: string }
  | { kind: "email.fallback"; from: EmailProvider; to: EmailProvider; originalError: string }
  | { kind: "email.provider"; provider: EmailProvider; action: "selected" | "skipped"; reason?: string };
