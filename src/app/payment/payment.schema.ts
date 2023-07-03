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

export type CreatePaymentPayload = z.infer<typeof createPaymentSchema>;
