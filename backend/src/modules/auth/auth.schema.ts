import z from "zod";

const EmailSchema = z.object({
  email: z
    .string("Email is required.")
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .max(256, "Email cannot exceed 256 characters.")
    .pipe(
      z.email({
        error: (iss) =>
          iss.code === "invalid_format"
            ? "Invalid email id."
            : "Email is required.",
      }),
    ),
});

const CreateAccountSchema = EmailSchema.extend({
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
  password: z
    .string("Password is required.")
    .min(1, "Password is required.")
    .min(8, "Password must be atleast 8 characters long."),
});

const VerifyAccountSchema = EmailSchema.extend({
  otp: z
    .string("OTP is required.")
    .trim()
    .min(1, "OTP is required.")
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
});

const LoginSchema = EmailSchema.extend({
  password: z.string("Password is required.").min(1, "Password is required."),
});

const ResetPasswordSchema = z.object({
  token: z
    .string("Token is required.")
    .trim()
    .min(1, "Token is required.")
    .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid token."),
  password: z
    .string("Password is required.")
    .min(1, "Password is required.")
    .min(8, "Password must be atleast 8 characters long."),
});

const LogoutQuerySchema = z.object({
  all: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => val === "true"),
});

export default {
  EmailSchema,
  CreateAccountSchema,
  VerifyAccountSchema,
  LoginSchema,
  ResetPasswordSchema,
  LogoutQuerySchema,
};
export type EmailSchema = z.infer<typeof EmailSchema>;
export type CreateAccountSchema = z.infer<typeof CreateAccountSchema>;
export type VerifyAccountSchema = z.infer<typeof VerifyAccountSchema>;
export type LoginSchema = z.infer<typeof LoginSchema>;
export type ResetPasswordSchema = z.infer<typeof ResetPasswordSchema>;
export type LogoutQuerySchema = z.infer<typeof LogoutQuerySchema>;
