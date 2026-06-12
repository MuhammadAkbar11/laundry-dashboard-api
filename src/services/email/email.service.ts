import type nodemailer from "nodemailer";
import BaseError from "../../helpers/error.helper";
import { BindAllMethods } from "../../utils/decorators.utils";
import { logEmailEvent, recipientToString } from "./email.logger";
import {
  AUTO_FAILOVER_ORDER,
  type EmailOptions,
  type EmailProvider,
  type EmailSendResult,
} from "./email.types";
import { getProvider, getAllProviders } from "./providers";

@BindAllMethods
class EmailService {
  async send(
    provider: EmailProvider,
    options: EmailOptions,
  ): Promise<EmailSendResult> {
    const chain = this.resolveProviderChain(provider);
    logEmailEvent(
      { kind: "email.provider", provider, action: "selected" },
      { to: options.to, subject: options.subject },
    );

    const attempts: EmailSendResult["attempts"] = [];
    let lastError: string | undefined;

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const isLast = i === chain.length - 1;

      const emailProvider = getProvider(current);
      if (!emailProvider) {
        logEmailEvent(
          {
            kind: "email.provider",
            provider: current,
            action: "skipped",
            reason: "unknown provider",
          },
          { to: options.to, subject: options.subject },
        );
        attempts.push({
          provider: current,
          ok: false,
          error: "unknown provider",
        });
        if (isLast) {
          lastError = `unknown provider: ${current}`;
          break;
        }
        continue;
      }

      if (!emailProvider.isConfigured()) {
        logEmailEvent(
          {
            kind: "email.provider",
            provider: current,
            action: "skipped",
            reason: "missing env configuration",
          },
          { to: options.to, subject: options.subject },
        );
        attempts.push({
          provider: current,
          ok: false,
          error: "provider not configured",
        });
        if (isLast) {
          lastError = `${current} not configured`;
          break;
        }
        continue;
      }

      try {
        const result = await this.dispatch(emailProvider, options);
        attempts.push({ provider: current, ok: true });
        logEmailEvent(
          {
            kind: "email.sent",
            provider: current,
            to: recipientToString(options.to),
            subject: options.subject || "",
            messageId: result.messageId,
          },
          { to: options.to, subject: options.subject },
        );
        return {
          provider: current,
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected,
          response: result.response,
          attempts,
        };
      } catch (err: any) {
        const message = this.errorMessage(err);
        attempts.push({ provider: current, ok: false, error: message });
        logEmailEvent(
          {
            kind: "email.failed",
            provider: current,
            to: recipientToString(options.to),
            subject: options.subject || "",
            error: message,
          },
          { to: options.to, subject: options.subject },
        );
        lastError = message;

        if (!isLast) {
          const next = chain[i + 1];
          logEmailEvent({
            kind: "email.fallback",
            from: current,
            to: next,
            originalError: message,
          });
        }
      }
    }

    throw new BaseError(
      "MAIL_ERR",
      500,
      `Failed to send email via ${provider}: ${lastError || "no provider attempted"}`,
      { isOperational: true, attempts },
    );
  }

  async sendTemplated(
    provider: EmailProvider,
    template:
      | {
          id: "welcome";
          options: Parameters<
            typeof import("../../templates/email/welcome.template").renderWelcomeEmail
          >[0];
        }
      | {
          id: "password-reset";
          options: Parameters<
            typeof import("../../templates/email/password-reset.template").renderPasswordResetEmail
          >[0];
        }
      | {
          id: "verify-email";
          options: Parameters<
            typeof import("../../templates/email/verify-email.template").renderVerifyEmail
          >[0];
        },
    delivery: {
      to: EmailOptions["to"];
      cc?: EmailOptions["cc"];
      bcc?: EmailOptions["bcc"];
      replyTo?: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = await this.renderTemplate(template);
    return this.send(provider, {
      to: delivery.to,
      cc: delivery.cc,
      bcc: delivery.bcc,
      replyTo: delivery.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private resolveProviderChain(provider: EmailProvider): string[] {
    if (provider === "auto") {
      return [...AUTO_FAILOVER_ORDER];
    }
    return [provider];
  }

  private async dispatch(
    provider: {
      getDefaultFrom(): string;
      createTransporter(): Promise<nodemailer.Transporter>;
    },
    options: EmailOptions,
  ): Promise<nodemailer.SentMessageInfo> {
    const transporter = await provider.createTransporter();
    const from = options.from || provider.getDefaultFrom();
    const mailOptions: nodemailer.SendMailOptions = {
      ...options,
      from,
    };
    return transporter.sendMail(mailOptions);
  }

  private async renderTemplate(
    template:
      | { id: "welcome"; options: any }
      | { id: "password-reset"; options: any }
      | { id: "verify-email"; options: any },
  ): Promise<{ subject: string; html: string; text: string }> {
    switch (template.id) {
      case "welcome": {
        const mod = await import("../../templates/email/welcome.template");
        return mod.renderWelcomeEmail(template.options);
      }
      case "password-reset": {
        const mod =
          await import("../../templates/email/password-reset.template");
        return mod.renderPasswordResetEmail(template.options);
      }
      case "verify-email": {
        const mod = await import("../../templates/email/verify-email.template");
        return mod.renderVerifyEmail(template.options);
      }
      default: {
        const _exhaustive: never = template;
        void _exhaustive;
        throw new BaseError(
          "MAIL_ERR",
          500,
          `Unknown email template: ${String((template as any).id)}`,
        );
      }
    }
  }

  private errorMessage(err: any): string {
    if (!err) return "unknown error";
    if (typeof err === "string") return err;
    return err.message || err.name || "unknown error";
  }

  healthCheck(): {
    failoverOrder: ReadonlyArray<string>;
    providers: Record<
      string,
      { configured: boolean; fromAddress: string; displayName: string }
    >;
  } {
    const providers: Record<
      string,
      { configured: boolean; fromAddress: string; displayName: string }
    > = {};
    for (const [id, provider] of getAllProviders()) {
      providers[id] = {
        configured: provider.isConfigured(),
        fromAddress: provider.getDefaultFrom(),
        displayName: provider.displayName,
      };
    }
    return {
      failoverOrder: AUTO_FAILOVER_ORDER,
      providers,
    };
  }
}

export default EmailService;
