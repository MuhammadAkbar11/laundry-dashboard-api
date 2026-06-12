import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import type {
  EmailPayload,
  EmailTestSendPayload,
  EmailTestTemplatePayload,
} from "./email.schema";
import EmailService from "../../services/email/email.service";
import { renderWelcomeEmail } from "../../templates/email/welcome.template";
import { renderPasswordResetEmail } from "../../templates/email/password-reset.template";
import { renderVerifyEmail } from "../../templates/email/verify-email.template";
import type { EmailProvider } from "../../services/email/email.types";

/**
 * Email controller — routes now go through the centralised `EmailService`
 * which delegates to registered providers. The provider selection is part
 * of the URL (`/email/gmail`, `/email/zohomail`, `/email/auto`).
 *
 * Test endpoints:
 * - `GET  /email/health`           — provider configuration status
 * - `POST /email/test/send`        — send a raw test email (dryRun
 *                                   supported)
 * - `POST /email/test/template`    — send a templated test email
 *                                   (welcome | password-reset |
 *                                   verify-email; dryRun supported)
 *
 * NOTE: the existing `/email/*` routes are not behind authentication
 * middleware. The test endpoints follow the same pattern for now; in
 * production they should be restricted to admin users (e.g. via
 * `auth.middleware` / `requireRole`).
 */
@BindAllMethods
class EmailController extends BaseController {
  private service: EmailService;

  constructor() {
    super();
    this.service = new EmailService();
  }

  private async sendFor(
    provider: EmailProvider,
    req: Request<{}, {}, EmailPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { to, subject, text, html } = req.body;
      const result = await this.service.send(provider, {
        to,
        subject,
        text,
        html,
      });

      res.status(200).json({
        message: `Success sending email via ${provider} provider`,
        provider: result.provider,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        attempts: result.attempts,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postGmailMail(
    req: Request<{}, {}, EmailPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    return this.sendFor("gmail", req, res, next);
  }

  public async postZohoMail(
    req: Request<{}, {}, EmailPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    return this.sendFor("zohomail", req, res, next);
  }

  /**
   * Auto endpoint — uses the failover chain. Tries providers in order.
   * No duplicate delivery: the service only attempts the next provider
   * if the previous one actually failed.
   */
  public async postAutoMail(
    req: Request<{}, {}, EmailPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    return this.sendFor("auto", req, res, next);
  }

  /**
   * GET /email/health — report provider configuration status without
   * performing any network I/O. Useful for ops dashboards and for
   * the test endpoint to confirm the env wiring before sending.
   */
  public async getHealth(_req: Request, res: Response) {
    const health = this.service.healthCheck();
    res.status(200).json({
      message: "Email service health",
      health,
    });
  }

  /**
   * POST /email/test/send — send a raw test email through the
   * centralised EmailService. `dryRun: true` returns the rendered
   * subject / html / text without invoking the transporter.
   */
  public async postTestSend(
    req: Request<{}, {}, EmailTestSendPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { to, provider, subject, text, html, dryRun } = req.body;

      if (dryRun) {
        const previewHtml =
          html ||
          (text
            ? `<pre style="font-family:inherit">${escapeHtml(text)}</pre>`
            : "");
        res.status(200).json({
          message: "Dry run — no email sent",
          dryRun: true,
          provider,
          to,
          subject,
          text,
          html: previewHtml,
        });
        return;
      }

      const result = await this.service.send(provider, {
        to,
        subject,
        text,
        html,
      });
      res.status(200).json({
        message: `Success sending test email via ${provider} provider`,
        dryRun: false,
        provider: result.provider,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        attempts: result.attempts,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  /**
   * POST /email/test/template — render a template (welcome,
   * password-reset, verify-email) and either send it or return the
   * rendered output (when `dryRun: true`).
   */
  public async postTestTemplate(
    req: Request<{}, {}, EmailTestTemplatePayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const {
        to,
        provider,
        template,
        memberName,
        appUrl,
        resetUrl,
        expiresInMinutes,
        verifyUrl,
        expiresInHours,
        dryRun,
      } = req.body;

      const rendered = renderTemplateById(template, {
        memberName: memberName || "Pelanggan Test",
        appUrl,
        resetUrl,
        expiresInMinutes,
        verifyUrl,
        expiresInHours,
      });

      if (dryRun) {
        res.status(200).json({
          message: `Dry run — template ${template} rendered, no email sent`,
          dryRun: true,
          provider,
          to,
          template,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
        return;
      }

      const result = await this.service.send(provider, {
        to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      res.status(200).json({
        message: `Success sending ${template} template via ${provider} provider`,
        dryRun: false,
        provider: result.provider,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        attempts: result.attempts,
        template,
        subject: rendered.subject,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

function renderTemplateById(
  id: "welcome" | "password-reset" | "verify-email",
  options: {
    memberName: string;
    appUrl?: string;
    resetUrl?: string;
    expiresInMinutes?: number | string;
    verifyUrl?: string;
    expiresInHours?: number | string;
  },
): { subject: string; html: string; text: string } {
  switch (id) {
    case "welcome":
      return renderWelcomeEmail({
        memberName: options.memberName,
        appUrl: options.appUrl,
      });
    case "password-reset":
      return renderPasswordResetEmail({
        memberName: options.memberName,
        appUrl: options.appUrl,
        resetUrl: options.resetUrl,
        expiresInMinutes: options.expiresInMinutes,
      });
    case "verify-email":
      return renderVerifyEmail({
        memberName: options.memberName,
        appUrl: options.appUrl,
        verifyUrl: options.verifyUrl,
        expiresInHours: options.expiresInHours,
      });
    default: {
      const _exhaustive: never = id;
      void _exhaustive;
      throw new Error(`Unknown template id: ${String(id)}`);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default EmailController;
