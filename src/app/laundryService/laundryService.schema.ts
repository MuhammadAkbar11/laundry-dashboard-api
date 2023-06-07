import { ServiceUnit } from "@prisma/client";
import { z } from "zod";

export const createLaundryServiceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .max(128, { message: "Name should not exceed 128 characters" }),
    description: z.string(),
    unit: z.nativeEnum(ServiceUnit, { required_error: "Unit is required" }),
    price: z.number().int(),
  }),
});

export const updateLaundryServiceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .max(128, { message: "Name should not exceed 128 characters" })
      .optional(),
    description: z.string().optional(),
    unit: z.nativeEnum(ServiceUnit).optional(),
    price: z.number().int().optional(),
  }),
  params: z.object({
    serviceId: z.string().max(21, {
      message: "Laundry Service ID should not exceed 21 characters",
    }),
  }),
});

export const deleteLaundryServiceSchema = z.object({
  params: z.object({
    serviceId: z.string().max(21, {
      message: "Laundry Service ID should not exceed 21 characters",
    }),
  }),
});

export const getLaundryServiceSchema = z.object({
  query: z.object({
    _isFiltered: z.boolean().optional(),
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
  }),
});

export const getByIdLaundryServiceSchema = z.object({
  params: z.object({
    serviceId: z.string().max(21, {
      message: "Laundry Service ID should not exceed 21 characters",
    }),
  }),
});

export type CreateLaundryServicePayload = z.infer<
  typeof createLaundryServiceSchema
>;
export type UpdateLaundryServicePayload = z.infer<
  typeof updateLaundryServiceSchema
>;
export type DeleteLaundryServicePayload = z.infer<
  typeof deleteLaundryServiceSchema
>;
export type GetLaundryServicePayload = z.infer<typeof getLaundryServiceSchema>;
export type GetByIdLaundryServicePayload = z.infer<
  typeof getByIdLaundryServiceSchema
>;
