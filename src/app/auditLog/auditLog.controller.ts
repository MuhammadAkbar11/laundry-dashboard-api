import { NextFunction, Request, Response } from "express";
import { AuditAction, AuditEntityType, AuditLog, Prisma } from "@prisma/client";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import AuditLogService from "./auditLog.service";
import Pagination from "../../helpers/pagination.helper";
import { parsingResult } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";
import {
  ReadAuditLogByIdPayload,
  ReadAuditLogPayload,
} from "./auditLog.schema";

type AuditLogSorting =
  SortingTypes<Prisma.AuditLogOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class AuditLogController extends BaseController {
  private readonly service = new AuditLogService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): AuditLogSorting {
    return {
      [`${orderBy || "createdAt"}`]: sortBy || "desc",
    };
  }

  private searching(query: string): Prisma.Enumerable<Prisma.AuditLogWhereInput> {
    return [
      { actorName: { contains: query } },
      { entityId: { contains: query } },
      { metadata: { contains: query } },
    ];
  }

  public async get(
    req: Request<{}, {}, {}, ReadAuditLogPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const {
        _search,
        _page = 1,
        _limit = 10,
        _orderBy,
        _sortBy,
        _action,
        _entityType,
        _actorId,
        _startDate,
        _endDate,
      } = req.query;

      let where: Prisma.AuditLogWhereInput = {};

      const paginated = new Pagination<AuditLog>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "auditLogs",
      });

      const { limit, skip } = paginated.getPagination();
      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      if (_search) {
        where = {
          ...where,
          OR: this.searching(_search),
        };
      }

      if (_action && Object.values(AuditAction).includes(_action as AuditAction)) {
        where = {
          ...where,
          action: { equals: _action as AuditAction },
        };
      }

      if (
        _entityType &&
        Object.values(AuditEntityType).includes(_entityType as AuditEntityType)
      ) {
        where = {
          ...where,
          entityType: { equals: _entityType as AuditEntityType },
        };
      }

      if (_actorId) {
        where = {
          ...where,
          actorId: { equals: _actorId },
        };
      }

      if (_startDate || _endDate) {
        where = {
          ...where,
          createdAt: {
            gte: _startDate ? new Date(_startDate) : undefined,
            lte: _endDate ? new Date(_endDate) : undefined,
          },
        };
      }

      const [auditLogs, total] = await Promise.all([
        this.service.getAll({
          where,
          skip,
          take: limit,
          orderBy: sorting,
        }),
        this.service.count({ where }),
      ]);

      const data = paginated.getPagingData(
        Number(total),
        parsingResult(auditLogs) as AuditLog[],
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Audit Log"),
        data: { search: _search, ...data },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getById(
    req: Request<ReadAuditLogByIdPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const auditLogIdParam = req.params.auditLogId;

    try {
      const auditLog = await this.service.getById(auditLogIdParam);

      if (!auditLog) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Audit Log", auditLogIdParam),
        );
      }

      let parsedMetadata: Record<string, any> | null = null;
      if (auditLog.metadata) {
        try {
          parsedMetadata = JSON.parse(auditLog.metadata);
        } catch {
          parsedMetadata = null;
        }
      }

      res.status(200).json({
        message: this.getSuccessMessage("readById", "Audit Log", auditLogIdParam),
        auditLog: parsingResult({
          ...auditLog,
          metadata: parsedMetadata,
        }),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default AuditLogController;