import { AuditAction, AuditEntityType, AuditLog, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";

export interface CreateAuditLogInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, any>;
}

@BindAllMethods
class AuditLogService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_audit_logs",
      primaryKey: "audit_log_id",
      lengthPKValue: 8,
    };
  }

  public async create(
    payload: CreateAuditLogInput,
    prismaTrx?: Prisma.TransactionClient,
  ): Promise<AuditLog | void> {
    try {
      const auditLogId = await this.createPrimaryKeyValue(prismaTrx);
      const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null;
      const client = prismaTrx || this.prisma;

      return await client.auditLog.create({
        data: {
          auditLogId,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId,
          actorId: payload.actorId || null,
          actorName: payload.actorName || null,
          actorRole: payload.actorRole || null,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] createAuditLog");
      this.throwError(error);
    }
  }

  public async getAll(
    options?: Prisma.AuditLogFindManyArgs,
  ): Promise<AuditLog[] | void> {
    try {
      return await this.prisma.auditLog.findMany(options);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllAuditLogs");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<AuditLog | null | void> {
    try {
      return await this.prisma.auditLog.findUnique({
        where: { auditLogId: id },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getAuditLogById");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.AuditLogCountArgs): Promise<number | void> {
    try {
      return await this.prisma.auditLog.count({ ...args });
    } catch (error) {
      this.logger.error("[EXCEPTION] countAuditLogs");
      this.throwError(error);
    }
  }
}

export default AuditLogService;