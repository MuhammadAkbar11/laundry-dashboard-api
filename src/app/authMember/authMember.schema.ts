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

export type SignInMemberPayload = z.TypeOf<typeof signInMemberSchema>;
export type SignUpMemberPayload = Omit<
  z.TypeOf<typeof signUpMemberSchema>,
  "body.passwordConfirmation"
>;
