import z from "zod";

export const signUpMemberSchema = z.object({
  body: z
    .object({
      username: z.string({
        required_error: "Username is required",
      }),
      password: z
        .string({
          required_error: "Password is required",
        })
        .min(6, "Password too short"),
      passwordConfirmation: z.string({
        required_error: "Confirm Password is required",
      }),
      email: z
        .string({
          required_error: "Email is required",
        })
        .email("Not a valid Email"),
    })
    .refine(data => data.password === data.passwordConfirmation, {
      message: "Passwords do not match!",
      path: ["passwordConfirmation"],
    }),
});

export const signInMemberSchema = z.object({
  body: z.object({
    email: z.string({
      required_error: "Email is required",
    }),
    password: z.string({
      required_error: "Password is required",
    }),
  }),
});

export const forgotMemberPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Not a valid Email"),
  }),
});

export const resetMemberPasswordSchema = z.object({
  body: z.object({
    token: z.string({ required_error: "Token is required" }).min(1),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password too short"),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string({ required_error: "Token is required" }).min(1),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Not a valid Email"),
  }),
});

export type SignInMemberPayload = z.TypeOf<typeof signInMemberSchema>;
export type SignUpMemberPayload = Omit<
  z.TypeOf<typeof signUpMemberSchema>,
  "body.passwordConfirmation"
>;
export type ForgotMemberPasswordPayload = z.TypeOf<
  typeof forgotMemberPasswordSchema
>;
export type ResetMemberPasswordPayload = z.TypeOf<
  typeof resetMemberPasswordSchema
>;
export type VerifyEmailPayload = z.TypeOf<typeof verifyEmailSchema>;
export type ResendVerificationPayload = z.TypeOf<typeof resendVerificationSchema>;
