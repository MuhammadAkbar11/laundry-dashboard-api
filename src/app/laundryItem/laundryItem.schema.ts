import { z } from "zod";

export const createLaundryItemSchema = z.object({
  body: z.object({
    quantity: z.number({ required_error: "Quantity is required" }),
    laundryQueueId: z
      .string()
      .trim()
      .nonempty("Laundry Queue ID is required")
      .max(21),
    serviceId: z
      .string()
      .trim()
      .nonempty("Laundry Service ID is required")
      .max(21),
    note: z.string().optional(),
  }),
});

export const updateLaundryItemSchema = z.object({
  body: z.object({
    quantity: z.number({ required_error: "Quantity is required" }),
    serviceId: z
      .string()
      .trim()
      .nonempty("Laundry Service ID is required")
      .max(21),
    note: z.string().optional(),
  }),
  params: z.object({
    laundryItemId: z.string().max(21),
  }),
});

export const deleteLaundryItemSchema = z.object({
  params: z.object({
    laundryItemId: z.string().max(21),
  }),
});

export const readByIDLaundryItemSchema = z.object({
  params: z.object({
    laundryItemId: z.string().max(21),
  }),
});

export type CreateLaundryItemPayload = z.infer<typeof createLaundryItemSchema>;
export type UpdateLaundryItemPayload = z.infer<typeof updateLaundryItemSchema>;
export type DeleteLaundryItemPayload = z.infer<typeof deleteLaundryItemSchema>;
export type ReadByIDLaundryItemPayload = z.infer<
  typeof readByIDLaundryItemSchema
>;
