import z from "zod";

export const signUpUserSchema = z.object({
  body: z
    .object({
      name: z.string({
        required_error: "Name is required",
      }),
      password: z
        .string({
          required_error: "Password is required",
        })
        .min(6, "Passowrd to short"),
      passwordConfirmation: z.string({
        required_error: "Confirm Password is required",
      }),
      email: z
        .string({
          required_error: "Email is required",
        })
        .email("Not a valid Email"),
      role: z
        .string({
          required_error: "Email is required",
        })
        .optional(),
    })
    .refine(data => data.password == data.passwordConfirmation, {
      message: "Password do not match!",
      path: ["passwordConfirmation"],
    }),
});

export const signInUserSchema = z.object({
  body: z.object({
    password: z.string({
      required_error: "Password is required",
    }),
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Not a valid Email"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Not a valid Email"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string({ required_error: "Token is required" }).min(1),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password too short"),
  }),
});

export type SignInUserPayload = z.TypeOf<typeof signInUserSchema>;

export type SignUpUserPayload = Omit<
  z.TypeOf<typeof signUpUserSchema>,
  "body.passwordConfirmation"
>;

export type ForgotPasswordPayload = z.TypeOf<typeof forgotPasswordSchema>;

export type ResetPasswordPayload = z.TypeOf<typeof resetPasswordSchema>;
