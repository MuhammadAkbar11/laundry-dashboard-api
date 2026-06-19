import express from "express";
import { Role } from "@prisma/client";
import { BaseRouter } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { requireRole } from "../../middlewares/auth.middleware";
import validateResource from "../../middlewares/validate.middleware";
import NotificationTemplateController from "./notificationTemplate.controller";
import {
  previewNotificationTemplateSchema,
  readNotificationTemplateByIdSchema,
  readNotificationTemplateSchema,
  resetNotificationTemplateSchema,
  updateNotificationTemplateSchema,
} from "./notificationTemplate.schema";

@BindAllMethods
class NotificationTemplateRouter extends BaseRouter<NotificationTemplateController> {
  constructor(protected express: express.Express) {
    super(NotificationTemplateController, express);
  }

  protected routes(): void {
    this.router.get(
      "/all",
      requireRole(Role.ADMIN),
      [validateResource(readNotificationTemplateSchema)],
      this.controller.get
    );

    this.router.get(
      "/:templateId",
      requireRole(Role.ADMIN),
      [validateResource(readNotificationTemplateByIdSchema)],
      this.controller.getById
    );

    this.router.put(
      "/:templateId",
      requireRole(Role.ADMIN),
      [validateResource(updateNotificationTemplateSchema)],
      this.controller.put
    );

    this.router.post(
      "/:templateId/preview",
      requireRole(Role.ADMIN),
      [validateResource(previewNotificationTemplateSchema)],
      this.controller.postPreview
    );

    this.router.post(
      "/:templateId/reset",
      requireRole(Role.ADMIN),
      [validateResource(resetNotificationTemplateSchema)],
      this.controller.postReset
    );
  }
}

export default NotificationTemplateRouter;