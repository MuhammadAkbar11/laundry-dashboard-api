import { z } from "zod";

export const createCustomerLevelSchema = z.object({
  body: z.object({
    name: z
      .string()
      .max(255, { message: "Name should not exceed 255 characters" }),
    point: z.number({ required_error: "Point is required" }).int(),
    discount: z.number({ required_error: "Discount is required" }).int(),
  }),
});

export const updateCustomerLevelSchema = z.object({
  body: z.object({
    name: z
      .string()
      .max(255, { message: "Name should not exceed 255 characters" })
      .optional(),
    point: z.number().int().optional(),
    discount: z.number().int().optional(),
  }),
  params: z.object({
    customerLevelId: z.string().max(21, {
      message: "Customer level ID should not exceed 21 characters",
    }),
  }),
});

export const deleteCustomerLevelSchema = z.object({
  params: z.object({
    customerLevelId: z.string().max(21, {
      message: "Customer level ID should not exceed 21 characters",
    }),
  }),
});

export const readCustomerLevelSchema = z.object({
  params: z.object({
    customerLevelId: z.string().max(21, {
      message: "Customer level ID should not exceed 21 characters",
    }),
  }),
});

export type CreateCustomerLevelPayload = z.infer<
  typeof createCustomerLevelSchema
>;
export type UpdateCustomerLevelPayload = z.infer<
  typeof updateCustomerLevelSchema
>;
export type DeleteCustomerLevelPayload = z.infer<
  typeof deleteCustomerLevelSchema
>;
export type ReadCustomerLevelPayload = z.infer<typeof readCustomerLevelSchema>;
