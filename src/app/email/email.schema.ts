import * as z from "zod";

export const emailSchema = z.object({
  body: z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    html: z.string().optional(),
  }),
});

export type EmailPayload = z.infer<typeof emailSchema>;

export const emailProviderSchema = z.enum(["gmail", "zohomail", "auto"]);

export const emailTestSendSchema = z.object({
  body: z.object({
    to: z.string().email(),
    provider: emailProviderSchema.default("auto"),
    subject: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    dryRun: z.boolean().optional().default(false),
  }),
});

export type EmailTestSendPayload = z.infer<typeof emailTestSendSchema>;

export const emailTestTemplateSchema = z.object({
  body: z.object({
    to: z.string().email(),
    provider: emailProviderSchema.default("auto"),
    template: z.enum(["welcome", "password-reset", "verify-email"]),
    memberName: z.string().optional(),
    appUrl: z.string().url().optional(),
    // password-reset
    resetUrl: z.string().url().optional(),
    expiresInMinutes: z.union([z.number(), z.string()]).optional(),
    // verify-email
    verifyUrl: z.string().url().optional(),
    expiresInHours: z.union([z.number(), z.string()]).optional(),
    dryRun: z.boolean().optional().default(false),
  }),
});

export type EmailTestTemplatePayload = z.infer<typeof emailTestTemplateSchema>;
