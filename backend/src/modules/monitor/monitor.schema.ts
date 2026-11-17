import z from "zod";
import { httpMethodEnum, monitorStatusEnum } from "../../db/schema";

const baseMonitorSchema = z.object({
  name: z
    .string("Name is required.")
    .trim()
    .min(1, "Name is required.")
    .max(128, "Name cannot exceed 128 characters.")
    .transform((val) => val.replace(/\s+/g, " ")),
  url: z
    .string("URL is required.")
    .trim()
    .min(1, "URL is required.")
    .pipe(z.url("Invalid URL.")),
  method: z.enum(
    httpMethodEnum.enumValues,
    "Invalid HTTP method. Allowed: GET, POST, HEAD.",
  ),
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(1, "Interval must be at least 1 minute.")
    .max(60, "Interval cannot exceed 60 minutes."),
  timeoutSeconds: z.coerce
    .number()
    .int()
    .min(3, "Timeout must be at least 3 seconds.")
    .max(30, "Timeout cannot exceed 30 seconds."),
  failureThreshold: z.coerce
    .number()
    .int()
    .min(1, "Failure threshold must be at least 1.")
    .max(10, "Failure threshold cannot exceed 10."),
  alertEmail: z
    .string("Alert email is required.")
    .trim()
    .toLowerCase()
    .min(1, "Alert email is required.")
    .max(256, "Alert email cannot exceed 256 characters.")
    .pipe(
      z.email({
        error: (iss) =>
          iss.code === "invalid_format"
            ? "Invalid alert email."
            : "Alert email is required.",
      }),
    ),
  webhookUrl: z.string().trim().pipe(z.url("Invalid webhook url.")).nullable(),
});

const CreateMonitorSchema = baseMonitorSchema.extend({
  method: baseMonitorSchema.shape.method.default("GET"),
  intervalMinutes: baseMonitorSchema.shape.intervalMinutes.default(5),
  timeoutSeconds: baseMonitorSchema.shape.timeoutSeconds.default(10),
  failureThreshold: baseMonitorSchema.shape.failureThreshold.default(2),
  alertEmail: baseMonitorSchema.shape.alertEmail.optional(),
  webhookUrl: baseMonitorSchema.shape.webhookUrl.optional(),
});

const GetMonitorListQuerySchema = z.object({
  search: z.string().trim().max(128).optional(),
  status: z.enum(monitorStatusEnum.enumValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const GetMonitorLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["all", "up", "down"]).default("all"),
});

export const GetMonitorIncidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["open", "resolved"]).optional(),
});

const UpdateMonitorSchema = baseMonitorSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

const DeleteMonitorSchema = z.object({
  name: z
    .string({ error: "Please enter the monitor name to confirm." })
    .trim()
    .min(1, "Please enter the monitor name to confirm.")
    .max(128, "Monitor name cannot exceed 128 characters.")
    .transform((val) => val.replace(/\s+/g, " ")),
});

export default {
  CreateMonitorSchema,
  GetMonitorListQuerySchema,
  GetMonitorLogsQuerySchema,
  GetMonitorIncidentsQuerySchema,
  UpdateMonitorSchema,
  DeleteMonitorSchema,
};
export type CreateMonitorSchema = z.infer<typeof CreateMonitorSchema>;
export type GetMonitorListQuerySchema = z.infer<
  typeof GetMonitorListQuerySchema
>;
export type GetMonitorLogsQuerySchema = z.infer<
  typeof GetMonitorLogsQuerySchema
>;
export type GetMonitorIncidentsQuerySchema = z.infer<
  typeof GetMonitorIncidentsQuerySchema
>;
export type UpdateMonitorSchema = z.infer<typeof UpdateMonitorSchema>;
export type DeleteMonitorSchema = z.infer<typeof DeleteMonitorSchema>;
