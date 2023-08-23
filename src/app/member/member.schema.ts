import z from "zod";

export const memberOrderSchema = z.object({
  body: z
    .object({
      deliveryType: z.string().nonempty("delivery type is required"),
      deliveryAddress: z.string().optional(),
      note: z.string().optional(),
      pickupAt: z.string().nonempty("pickup date is required"),
      services: z
        .array(z.string())
        .nonempty({ message: "At least one service must be chosen." }),
    })
    .refine(
      data => {
        return data.deliveryType === "DELIVERED"
          ? data.deliveryAddress !== ""
          : true;
      },
      {
        message: "Addres is required",
        path: ["deliveryAddress"],
      }
    ),
});

export const readMemberLaundryQueueSchema = z.object({
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
        "status",
        "finishedAt",
        "createdAt",
        "pickupAt",
        "deliveryAt",
        "deliveryAddress",
      ])
      .optional(),
    _sortBy: z.enum(["asc", "desc"]).optional(),
  }),
});

export const readMemberTrxSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z
      .enum([
        "laundryQueueId",
        "queuePaymentStatus",
        "status",
        "finishedAt",
        "customerId",
        "deliveryAt",
        "deliveryType",
        "note",
        "deliveryAddress",
        "pickupAt",
        "paymentId",
        "invoice",
        "price",
        "discount",
        "paid",
        "cashback",
        "paymentMethod",
        "createdAt",
        "updatedAt",
        "userId",
        "totalPrice",
        "totalLaundry",
      ])
      .optional(),
    _sortBy: z.string().optional(),
  }),
});

export const readMemberLaundryRoomDetailSchema = z.object({
  params: z.object({
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
});

export const postMemberPaymentSchema = z.object({
  body: z.object({
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
    paymentMethod: z
      .string({ required_error: "Payment Method is Required" })
      .nonempty("Payment Method is Required"),
  }),
});

export const readMemberLaundryQueueByIDSchema = z.object({
  params: z.object({
    laundryQueueId: z
      .string()
      .nonempty("Laundry queue ID is required")
      .max(21, "Laundry queue ID should not exceed 21 characters"),
  }),
});

export const readMemberPaymentByInvoiceSchema = z.object({
  params: z.object({
    invoice: z.string().nonempty("Invoice is required"),
  }),
});

export const updateMemberProfileSchema = z.object({
  body: z.object({
    // email: z.string().email(),
    username: z.string(),
    name: z.string(),
    address: z.string(),
    phone: z.string(),
  }),
});

export type MemberOrderPayload = z.TypeOf<typeof memberOrderSchema>;
export type PostPaymentPayload = z.TypeOf<typeof postMemberPaymentSchema>;
export type ReadMemberLaundryQueuePayload = z.TypeOf<
  typeof readMemberLaundryQueueSchema
>;
export type ReadMemberLaundryRoomDetailPayload = z.TypeOf<
  typeof readMemberLaundryRoomDetailSchema
>;
export type ReadMemberLaundryQueueByIDPayload = z.TypeOf<
  typeof readMemberLaundryQueueByIDSchema
>;
export type ReadMemberPaymentByInvoicePayload = z.TypeOf<
  typeof readMemberPaymentByInvoiceSchema
>;
export type ReadMemberTrxPayload = z.TypeOf<typeof readMemberTrxSchema>;
export type UpdateMemberProfilePayload = z.TypeOf<
  typeof updateMemberProfileSchema
>;
