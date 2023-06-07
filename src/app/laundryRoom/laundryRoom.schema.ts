import { LaundryRoomStatus } from "@prisma/client";
import { z } from "zod";

export const updateLaundryRoomSchema = z.object({
  body: z.object({
    total: z.number({ required_error: "Total is required" }),
    status: z.nativeEnum(LaundryRoomStatus),
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
  params: z.object({
    laundryRoomId: z
      .string()
      .nonempty("Laundry room ID is required")
      .max(21, "Laundry room ID should not exceed 21 characters"),
  }),
});

export const deleteLaundryRoomSchema = z.object({
  params: z.object({
    laundryRoomId: z
      .string()
      .nonempty("Laundry room ID is required")
      .max(21, "Laundry room ID should not exceed 21 characters"),
  }),
});

export const readLaundryRoomSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z
      .enum([
        "total",
        "status",
        "createdAt",
        "updatedAt",
        "userId",
        "customerName",
        "userName",
        "laundryQueueId",
      ])
      .optional(),
    _sortBy: z.enum(["asc", "desc"]).optional(),
  }),
});

export const readByIDLaundryRoomSchema = z.object({
  params: z.object({
    laundryRoomId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
});

export const updateLaundryRoomFinishedSchema = z.object({
  body: z.object({
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
  params: z.object({
    laundryRoomId: z
      .string()
      .nonempty("Laundry room ID is required")
      .max(21, "Laundry room ID should not exceed 21 characters"),
  }),
});

export type UpdateLaundryRoomPayload = z.infer<typeof updateLaundryRoomSchema>;
export type DeleteLaundryRoomPayload = z.infer<typeof deleteLaundryRoomSchema>;
export type ReadLaundryRoomPayload = z.infer<typeof readLaundryRoomSchema>;
export type ReadByIDLaundryRoomPayload = z.infer<
  typeof readByIDLaundryRoomSchema
>;
export type UpdateLaundryRoomFinishedPayload = z.infer<
  typeof updateLaundryRoomFinishedSchema
>;
