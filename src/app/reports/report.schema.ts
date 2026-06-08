import { z } from "zod";

export const readReportTrxtSchema = z.object({
  query: z.object({
    _type: z
      .enum(["histories", "transactions"])
      .optional()
      .default("transactions"),
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
  }),
});

export const readReportTrxMonthsSchema = z.object({
  params: z.object({
    year: z
      .string()
      .nonempty("year is required")
      .min(1, "year is required")
      .max(4),
  }),
});

export const readReportTrxDateSchema = z.object({
  params: z.object({
    year: z
      .string()
      .nonempty("year is required")
      .min(1, "year is required")
      .max(4),
    month: z
      .string()
      .nonempty("month is required")
      .min(1, "month is required")
      .max(2),
  }),
});

export const readReportTrxFullDateSchema = z.object({
  query: z.object({
    year: z.string().nonempty("year is required"),
    month: z.string().nonempty("month is required"),
    day: z.string().nonempty("day is required"),
    page: z.string().optional().default("1"), // Page number should be positive integer
    limit: z.string().optional(), // Page size should be positive integer
  }),
});

export const readReportTrxPeriodDateSchema = z.object({
  params: z.object({
    startDate: z.string().nonempty("startDate is required"),
    endDate: z.string().nonempty("endDate is required"),
  }),
  query: z.object({
    page: z.string().optional().default("1"), // Page number should be positive integer
    limit: z.string().optional(), // Page size should be positive integer
  }),
});

export const readReportCashflowSchema = z.object({
  query: z.object({
    _page: z.string().optional().default("1"), // Page number should be positive integer
    _limit: z.string().optional().default("10"), // Page size should be positive integer
  }),
});

export type ReadReportTrxPayload = z.infer<typeof readReportTrxtSchema>;
export type ReadReportTrxMonthPayload = z.infer<
  typeof readReportTrxMonthsSchema
>;
export type ReadReportTrxDatePayload = z.infer<typeof readReportTrxDateSchema>;
export type ReadReportTrxFullDatePayload = z.infer<
  typeof readReportTrxFullDateSchema
>;
export type ReadReportTrxPeriodDatePayload = z.infer<
  typeof readReportTrxPeriodDateSchema
>;
export type ReadReportCashFlowload = z.infer<typeof readReportCashflowSchema>;
