import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import NotificationTemplateService from "./notificationTemplate.service";
import AuditLogService from "../auditLog/auditLog.service";
import { parsingResult } from "../../utils/utils";
import {
  PreviewNotificationTemplatePayload,
  ReadNotificationTemplateByIdPayload,
  ReadNotificationTemplatePayload,
  ResetNotificationTemplatePayload,
  UpdateNotificationTemplatePayload,
} from "./notificationTemplate.schema";

@BindAllMethods
class NotificationTemplateController extends BaseController {
  private readonly service = new NotificationTemplateService();
  private readonly auditLogService = new AuditLogService();

  constructor() {
    super();
  }

  public async get(
    req: Request<{}, {}, {}, ReadNotificationTemplatePayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search } = req.query;
      const page = Number(req.query._page ?? 1) || 1;
      const limit = Math.min(
        Math.max(Number(req.query._limit ?? 20) || 20, 1),
        100
      );
      const skip = (page - 1) * limit;

      const where = _search
        ? {
            OR: [
              { titleTemplate: { contains: _search } },
              { messageTemplate: { contains: _search } },
              {
                notificationType: {
                  OR: [
                    { code: { contains: _search } },
                    { name: { contains: _search } },
                  ],
                },
              },
            ],
          }
        : undefined;

      const [templates, total] = await Promise.all([
        this.service.getAll({
          where,
          skip,
          take: limit,
        }),
        this.prisma.notificationTemplate.count({ where }),
      ]);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Template Notifikasi"),
        data: {
          templates: parsingResult(templates),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          page,
          limit,
        },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getById(
    req: Request<ReadNotificationTemplateByIdPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const template = await this.service.getById(req.params.templateId);
      if (!template) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Template",
            req.params.templateId
          )
        );
      }
      res.status(200).json({
        message: this.getSuccessMessage("readById", "Template", req.params.templateId),
        template: parsingResult(template),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateNotificationTemplatePayload["params"],
      {},
      UpdateNotificationTemplatePayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const existing = await this.service.getById(req.params.templateId);
      const updated = await this.service.update(req.params.templateId, {
        titleTemplate: req.body.titleTemplate,
        messageTemplate: req.body.messageTemplate,
      });
      await this.auditLogService.create({
        action: "UPDATE",
        entityType: "NOTIFICATION_TEMPLATE",
        entityId: req.params.templateId,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          before: {
            titleTemplate: existing?.titleTemplate,
            messageTemplate: existing?.messageTemplate,
          },
          after: {
            titleTemplate: updated?.titleTemplate,
            messageTemplate: updated?.messageTemplate,
          },
        },
      });
      res.status(200).json({
        message: this.getSuccessMessage("update", "Template", req.params.templateId),
        template: parsingResult(updated),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postPreview(
    req: Request<
      PreviewNotificationTemplatePayload["params"],
      {},
      PreviewNotificationTemplatePayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const template = await this.service.getById(req.params.templateId);
      if (!template) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Template",
            req.params.templateId
          )
        );
      }
      const preview = await this.service.preview(
        template.supportedVariables,
        req.body.titleTemplate,
        req.body.messageTemplate
      );
      res.status(200).json({
        message: "Preview template",
        preview,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postReset(
    req: Request<ResetNotificationTemplatePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const existing = await this.service.getById(req.params.templateId);
      const updated = await this.service.resetToDefault(req.params.templateId);
      await this.auditLogService.create({
        action: "UPDATE",
        entityType: "NOTIFICATION_TEMPLATE",
        entityId: req.params.templateId,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          resetToDefault: true,
          before: {
            titleTemplate: existing?.titleTemplate,
            messageTemplate: existing?.messageTemplate,
          },
          after: {
            titleTemplate: updated?.titleTemplate,
            messageTemplate: updated?.messageTemplate,
          },
        },
      });
      res.status(200).json({
        message: this.getSuccessMessage("update", "Template", req.params.templateId),
        template: parsingResult(updated),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default NotificationTemplateController;
