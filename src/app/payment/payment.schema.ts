import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    laundryQueueId: z.string().nonempty("ID Antrian wajib diisi").max(21),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paidAmount: z.number().min(0),
    promoCode: z.string().optional(),
  }),
});

export const readPaymentSchema = z.object({
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

export const readPaymentByInvoiceSchema = z.object({
  params: z.object({
    invoice: z.string().nonempty("Invoice is required"),
  }),
});

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
export type ReadPaymentPayload = z.infer<typeof readPaymentSchema>;
export type ReadPaymentByInvoicePayload = z.infer<
  typeof readPaymentByInvoiceSchema
>;
