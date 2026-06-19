import { z } from "zod";

export const readNotificationTemplateSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.coerce.number().int().min(1).optional(),
    _limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const readNotificationTemplateByIdSchema = z.object({
  params: z.object({
    templateId: z.string().uuid("Template ID tidak valid"),
  }),
});

export const updateNotificationTemplateSchema = z.object({
  params: z.object({
    templateId: z.string().uuid("Template ID tidak valid"),
  }),
  body: z.object({
    titleTemplate: z
      .string({ required_error: "Judul template wajib diisi" })
      .trim()
      .min(1, "Judul template wajib diisi")
      .max(255, "Judul template maksimal 255 karakter"),
    messageTemplate: z
      .string({ required_error: "Pesan template wajib diisi" })
      .trim()
      .min(1, "Pesan template wajib diisi"),
  }),
});

export const previewNotificationTemplateSchema = z.object({
  params: z.object({
    templateId: z.string().uuid("Template ID tidak valid"),
  }),
  body: z.object({
    titleTemplate: z.string().trim().min(1).max(255),
    messageTemplate: z.string().trim().min(1),
  }),
});

export const resetNotificationTemplateSchema = z.object({
  params: z.object({
    templateId: z.string().uuid("Template ID tidak valid"),
  }),
});

export type ReadNotificationTemplatePayload = z.infer<
  typeof readNotificationTemplateSchema
>;
export type ReadNotificationTemplateByIdPayload = z.infer<
  typeof readNotificationTemplateByIdSchema
>;
export type UpdateNotificationTemplatePayload = z.infer<
  typeof updateNotificationTemplateSchema
>;
export type PreviewNotificationTemplatePayload = z.infer<
  typeof previewNotificationTemplateSchema
>;
export type ResetNotificationTemplatePayload = z.infer<
  typeof resetNotificationTemplateSchema
>;