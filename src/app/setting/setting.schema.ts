import { z } from "zod";

export const updateSettingSchema = z.object({
  body: z.object({
    settings: z.array(
      z.object({
        name: z.string({ required_error: "Nama setting wajib diisi" }),
        value: z.string({ required_error: "Nilai setting wajib diisi" }),
      })
    ),
  }),
});

export const readSettingSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
  }),
});

export type UpdateSettingPayload = z.infer<typeof updateSettingSchema>;
export type ReadSettingPayload = z.infer<typeof readSettingSchema>;