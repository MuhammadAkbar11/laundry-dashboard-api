import express from "express";
import { BaseRouter } from "../../core";
import { requiredUser, requireRole } from "../../middlewares/auth.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import validateResource from "../../middlewares/validate.middleware";
import AuditLogController from "./auditLog.controller";
import {
  readAuditLogByIdSchema,
  readAuditLogSchema,
} from "./auditLog.schema";
import { Role } from "@prisma/client";

@BindAllMethods
class AuditLogRouter extends BaseRouter<AuditLogController> {
  constructor(protected express: express.Express) {
    super(AuditLogController, express);
  }

  protected routes(): void {
    this.router.get(
      "/all",
      requiredUser,
      requireRole(Role.ADMIN),
      [validateResource(readAuditLogSchema)],
      this.controller.get,
    );

    this.router.get(
      "/:auditLogId",
      requiredUser,
      requireRole(Role.ADMIN),
      [validateResource(readAuditLogByIdSchema)],
      this.controller.getById,
    );
  }
}

export default AuditLogRouter;