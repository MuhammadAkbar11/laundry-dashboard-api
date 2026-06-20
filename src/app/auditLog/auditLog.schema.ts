import z from "zod";

export const readAuditLogSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
    _action: z.string().optional(),
    _entityType: z.string().optional(),
    _actorId: z.string().optional(),
    _startDate: z.string().optional(),
    _endDate: z.string().optional(),
  }),
});

export const readAuditLogByIdSchema = z.object({
  params: z.object({
    auditLogId: z
      .string()
      .nonempty("Audit Log ID is empty")
      .max(21, { message: "Audit Log ID should not exceed 21 characters" }),
  }),
});

export type ReadAuditLogPayload = z.infer<typeof readAuditLogSchema>;
export type ReadAuditLogByIdPayload = z.infer<typeof readAuditLogByIdSchema>;