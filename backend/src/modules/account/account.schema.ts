import z from "zod";

const usernameRegex = /^[A-Za-z0-9_]{3,32}$/;

const usernameField = z
  .string("Username is required.")
  .trim()
  .min(1, "Username is required.")
  .max(32, "Username cannot exceed 32 characters.")
  .regex(
    usernameRegex,
    "Username contains only letters, numbers, or underscores.",
  );

const CheckUsernameQuerySchema = z.object({ username: usernameField });

const UpdateAccountSchema = z
  .object({
    username: usernameField.optional(),
    firstName: z
      .string("First name is required.")
      .trim()
      .min(1, "First name is required.")
      .max(64, "First name cannot exceed 64 characters."),
    lastName: z
      .string("Last name is required.")
      .trim()
      .max(64, "Last name cannot exceed 64 characters.")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string("Current password must be a string.")
      .min(1, "Current password cannot be empty.")
      .optional(),
    newPassword: z
      .string("New password is required.")
      .min(8, "New password must be at least 8 characters long.")
      .max(128, "New password cannot exceed 128 characters."),
  })
  .refine(
    (data) =>
      !data.currentPassword || data.currentPassword !== data.newPassword,
    {
      message: "New password must be different from your current password.",
      path: ["newPassword"],
    },
  );

const RevokeSessionsQuerySchema = z
  .object({
    sessionId: z.string().trim().length(11, "Invalid session ID.").optional(),
    allOther: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
  })
  .refine((data) => Boolean(data.sessionId) || data.allOther === true, {
    message: "Provide either 'sessionId' or 'allOther=true'.",
  });

export default {
  CheckUsernameQuerySchema,
  UpdateAccountSchema,
  ChangePasswordSchema,
  RevokeSessionsQuerySchema,
};
export type CheckUsernameQuerySchema = z.infer<typeof CheckUsernameQuerySchema>;
export type UpdateAccountSchema = z.infer<typeof UpdateAccountSchema>;
export type ChangePasswordSchema = z.infer<typeof ChangePasswordSchema>;
export type RevokeSessionsQuerySchema = z.infer<
  typeof RevokeSessionsQuerySchema
>;
