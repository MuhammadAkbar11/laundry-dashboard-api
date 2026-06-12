import type { SendMailOptions } from "nodemailer";
import { DEVS_EMAIL, ZOHOMAIL } from "../configs/vars.config";
import BaseError from "./error.helper";
import { BindAllMethods } from "../utils/decorators.utils";
import { packageJsonInfo } from "../utils/utils";
import EmailService from "../services/email/email.service";
import type { EmailProvider } from "../services/email/email.types";

/**
 * Transporter identifiers accepted by the legacy `EmailSender`
 * constructor. The class is preserved for backward compatibility with
 * pre-issue-013 callers; new business code should use `EmailService`
 * directly.
 *
 * - `"gmail-oauth"`  → mapped to the `gmail` provider.
 * - `"gmail"`        → mapped to the `gmail` provider.
 * - `"zohomail"`     → mapped to the `zohomail` provider.
 * - `"auto"`         → mapped to the `auto` provider.
 */
type LegacyTransporterTypes = "gmail-oauth" | "gmail" | "zohomail" | "auto";

function legacyToProvider(t: LegacyTransporterTypes): EmailProvider {
  if (t === "gmail-oauth") return "gmail";
  return t;
}

/**
 * Thin wrapper around `EmailService` for backward compatibility.
 *
 * New business modules should use `EmailService` directly. This class
 * exists so pre-issue-013 call sites continue to work without
 * modification.
 */
@BindAllMethods
class EmailSender {
  private transporter: LegacyTransporterTypes;
  private service: EmailService;

  constructor(transporter?: LegacyTransporterTypes) {
    this.transporter = transporter || "gmail";
    this.service = new EmailService();
  }

  async sendEmail(emailOptions: SendMailOptions): Promise<void> {
    const provider = legacyToProvider(this.transporter);
    await this.service.send(provider, {
      to: emailOptions.to as any,
      cc: emailOptions.cc as any,
      bcc: emailOptions.bcc as any,
      subject: emailOptions.subject,
      text: typeof emailOptions.text === "string" ? emailOptions.text : undefined,
      html: typeof emailOptions.html === "string" ? emailOptions.html : undefined,
      attachments: emailOptions.attachments as any,
      replyTo: typeof emailOptions.replyTo === "string" ? emailOptions.replyTo : undefined,
      from: typeof emailOptions.from === "string" ? emailOptions.from : undefined,
      headers: emailOptions.headers as Record<string, string> | undefined,
    });
  }

  /**
   * Send the "OAuth refresh token expired" notification to the
   * developers. Uses the ZohoMail provider via EmailService.
   */
  static async sendRefreshTokenErrorEmail(): Promise<void> {
    try {
      const service = new EmailService();
      const appName = `"${packageJsonInfo().description}"`;

      const emailContent = `
      <html>
        <body>
          <p>Dear developer,</p>
          <p>We regret to inform you that the Google OAuth Refresh Token used for authentication in <strong><em>${appName}</em></strong> has expired or is invalid. This is preventing users from accessing certain features of the application.</p>
          <p>To resolve this issue, please take the following steps:</p>
          <ol>
            <li>Obtain a new Google OAuth Refresh Token.</li>
            <li>Update <strong><em>${appName}</em></strong> with the new Refresh Token.</li>
          </ol>
          <p>If you have any questions or need further assistance, please feel free to contact us.</p>
          <p>Thank you.</p> <br>
          <p>The <strong><em>${appName}</em></strong> Team</p>
        </body>
      </html>
      `;

      await service.send("zohomail", {
        from: ZOHOMAIL,
        to: DEVS_EMAIL,
        subject: `URGENT: Google OAuth Refresh Token Expired/Invalid for ${appName}`,
        html: emailContent,
      });
    } catch (err: any) {
      const errors = new BaseError(
        err?.name || "MAIL_ERR",
        err.statusCode,
        err.message,
        {
          isOperational: true,
        },
      );
      throw errors;
    }
  }
}

export default EmailSender;
