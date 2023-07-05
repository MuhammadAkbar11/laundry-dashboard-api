import z from "zod";

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().nonempty("Name is required"),
    email: z.string().nonempty("Email is required").email("Not a valid Email"),
    role: z
      .enum(["ADMIN", "OPERATOR", "OFFICER"])
      .optional()
      .default("OPERATOR"),
  }),
});

export const updateUserSchema = createUserSchema.extend({
  params: z.object({
    userId: z
      .string()
      .max(21, { message: "User ID should not exceed 21 characters" }),
  }),
});

export const readUserSchema = z.object({
  query: z.object({
    _search: z.string().optional(),
    _page: z.string().optional(),
    _limit: z.string().optional(),
    _orderBy: z.string().optional(),
    _sortBy: z.string().optional(),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    userId: z.string().nonempty("User ID is empty").max(21, {
      message: "User ID should not exceed 21 characters",
    }),
  }),
});

export const readOneUserSchema = z.object({
  params: z.object({
    userId: z
      .string()
      .max(21, { message: "User ID should not exceed 21 characters" }),
  }),
});

export type ReadOneUserPayload = z.infer<typeof readOneUserSchema>;
export type CreateUserPayload = z.TypeOf<typeof createUserSchema>;
export type UpdateUserPayload = z.TypeOf<typeof updateUserSchema>;
export type ReadUserPayload = z.infer<typeof readUserSchema>;
export type DeleteUserPayload = z.infer<typeof deleteUserSchema>;
