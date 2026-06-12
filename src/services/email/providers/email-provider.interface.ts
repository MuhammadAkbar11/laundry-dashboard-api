import type nodemailer from "nodemailer";

/**
 * Interface that every email provider must implement.
 */
export interface IEmailProvider {
  /** Unique identifier used in API payloads and logs (e.g. `"gmail"`). */
  readonly id: string;

  /** Human-readable name shown in health-check responses. */
  readonly displayName: string;

  /**
   * Best-effort check that the provider has all the environment
   * configuration required to attempt a send. Providers that return
   * `false` are skipped (logged as `skipped`) so the failover chain
   * can continue to the next configured provider.
   */
  isConfigured(): boolean;

  /**
   * Create a Nodemailer transporter for this provider. Called once per
   * send attempt. The transporter is an implementation detail — callers
   * must never cache or reuse transporters across sends.
   */
  createTransporter(): Promise<nodemailer.Transporter>;

  /**
   * Default "from" address for this provider. Used when the caller
   * does not supply an explicit `from` field in `EmailOptions`.
   */
  getDefaultFrom(): string;
}
