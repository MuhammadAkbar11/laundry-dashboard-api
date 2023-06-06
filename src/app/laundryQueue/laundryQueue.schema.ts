import { z } from "zod";

export const createLaundryQueueSchema = z.object({
  body: z
    .object({
      queuePaymentStatus: z.enum(["PENDING", "PAID", "CANCELLED"]).optional(),
      status: z.enum(["ONHOLD", "IN_PROGRESS", "FINISHED"]).optional(),
      deliveryType: z.enum(["DELIVERED", "PICKUP"]).optional(),
      finishedAt: z.string().optional(),
      deliveryAt: z.string().optional(),
      customerId: z.string().max(21),
      note: z.string(),
    })
    .refine(
      data => {
        if (!data?.finishedAt && !data?.deliveryAt) {
          return true;
        }
        return false;
      },
      { message: "FinishedAt and PickupAt cannot be provided at the same time" }
    ),
});

export const updateLaundryQueueDeliveredSchema = z.object({
  params: z.object({
    laundryQueueId: z.string().max(21),
  }),
});

export const deleteLaundryQueueSchema = z.object({
  params: z.object({
    laundryQueueId: z.string().max(21),
  }),
});

export const readLaundryQueueSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z
      .enum([
        "queuePaymentStatus",
        "laundryQueueId",
        "deliveryType",
        "total",
        "createdAt",
        "customerName",
        "userName",
      ])
      .optional(),
    _sortBy: z.enum(["asc", "desc"]).optional(),
  }),
});

export const readByIDLaundryQueueSchema = z.object({
  params: z.object({
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
});

export type CreateLaundryQueuePayload = z.infer<
  typeof createLaundryQueueSchema
>;
export type UpdateLaundryQueueDeliveredPayload = z.infer<
  typeof updateLaundryQueueDeliveredSchema
>;
export type DeleteLaundryQueuePayload = z.infer<
  typeof deleteLaundryQueueSchema
>;
export type ReadLaundryQueuePayload = z.infer<typeof readLaundryQueueSchema>;
export type ReadByIDLaundryQueuePayload = z.infer<
  typeof readByIDLaundryQueueSchema
>;
