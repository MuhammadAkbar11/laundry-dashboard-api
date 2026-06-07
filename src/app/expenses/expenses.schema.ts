import { z } from "zod";

export const createExpensesSchema = z.object({
  body: z.object({
    description: z
      .string({ required_error: "Deskripsi wajib diisi" })
      .min(1, "Deskripsi wajib diisi"),
    total: z
      .number({ required_error: "Total wajib diisi" })
      .positive("Total harus lebih dari 0"),
  }),
});

export const updateExpensesSchema = z.object({
  body: z.object({
    description: z.string().min(1, "Deskripsi wajib diisi").optional(),
    total: z.number().positive("Total harus lebih dari 0").optional(),
  }),
  params: z.object({
    expensesId: z
      .string({ required_error: "Expenses ID wajib diisi" })
      .max(21),
  }),
});

export const deleteExpensesSchema = z.object({
  params: z.object({
    expensesId: z
      .string({ required_error: "Expenses ID wajib diisi" })
      .max(21),
  }),
});

export const readExpensesSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
  }),
});

export const readByIDExpensesSchema = z.object({
  params: z.object({
    expensesId: z
      .string({ required_error: "Expenses ID wajib diisi" })
      .max(21),
  }),
});

export type CreateExpensesPayload = z.infer<typeof createExpensesSchema>;
export type UpdateExpensesPayload = z.infer<typeof updateExpensesSchema>;
export type DeleteExpensesPayload = z.infer<typeof deleteExpensesSchema>;
export type ReadExpensesPayload = z.infer<typeof readExpensesSchema>;
export type ReadByIDExpensesPayload = z.infer<typeof readByIDExpensesSchema>;