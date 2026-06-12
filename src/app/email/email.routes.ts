import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import EmailController from "./email.controller";
import validateResource from "../../middlewares/validate.middleware";
import {
  emailSchema,
  emailTestSendSchema,
  emailTestTemplateSchema,
} from "./email.schema";

/**
 * Email routes.
 *
 * Production-style endpoints:
 * - `POST /email/gmail`   — send via Gmail OAuth (primary).
 * - `POST /email/zohomail` — send via ZohoMail SMTP (legacy, retained
 *                             for the developer notification flow).
 * - `POST /email/auto`    — try providers in failover order.
 *
 * Test endpoints (issue 013 follow-up):
 * - `GET  /email/health`         — provider configuration status.
 * - `POST /email/test/send`      — send a raw test email. `dryRun: true`
 *                                  returns the rendered payload without
 *                                  actually sending.
 * - `POST /email/test/template`  — render a template (welcome |
 *                                  password-reset | verify-email) and
 *                                  either send it or return the
 *                                  rendered payload (dryRun).
 */
@BindAllMethods
class EmailRouter extends BaseRouter<EmailController> {
  constructor(protected express: express.Application) {
    super(EmailController, express);
  }

  protected routes(): void {
    this.router.get("/health", this.controller.getHealth);

    this.router.post(
      "/gmail",
      [validateResource(emailSchema)],
      this.controller.postGmailMail
    );

    this.router.post(
      "/zohomail",
      [validateResource(emailSchema)],
      this.controller.postZohoMail
    );

    this.router.post(
      "/auto",
      [validateResource(emailSchema)],
      this.controller.postAutoMail
    );

    this.router.post(
      "/test/send",
      [validateResource(emailTestSendSchema)],
      this.controller.postTestSend
    );

    this.router.post(
      "/test/template",
      [validateResource(emailTestTemplateSchema)],
      this.controller.postTestTemplate
    );
  }
}

export default EmailRouter;
