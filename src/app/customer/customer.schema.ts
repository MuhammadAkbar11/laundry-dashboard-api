import { z } from "zod";

export const createCustomerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Name is required" })
      .max(255, { message: "Name should not exceed 255 characters" }),
    address: z.string({ required_error: "Address is required" }),
    phone: z.string({ required_error: "Phone is required" }),
    customerLevelId: z.string({ required_error: "Phone is required" }).max(21, {
      message: "Customer level ID should not exceed 21 characters",
    }),
    point: z.number().int().default(0),
  }),
});

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .max(255, { message: "Name should not exceed 255 characters" })
      .optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    customerLevelId: z
      .string()
      .max(21, { message: "Customer level ID should not exceed 21 characters" })
      .optional(),
    point: z.number().int().optional(),
  }),
  params: z.object({
    customerId: z
      .string()
      .max(21, { message: "Customer ID should not exceed 21 characters" }),
  }),
});

export const deleteCustomerSchema = z.object({
  params: z.object({
    customerId: z
      .string()
      .max(21, { message: "Customer ID should not exceed 21 characters" }),
  }),
});

export const readCustomerSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
  }),
});

export const readOneCustomerSchema = z.object({
  params: z.object({
    customerId: z
      .string()
      .max(21, { message: "Customer ID should not exceed 21 characters" }),
  }),
});

export type CreateCustomerPayload = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerPayload = z.infer<typeof updateCustomerSchema>;
export type DeleteCustomerPayload = z.infer<typeof deleteCustomerSchema>;
export type ReadCustomerPayload = z.infer<typeof readCustomerSchema>;
export type ReadOneCustomerPayload = z.infer<typeof readOneCustomerSchema>;
