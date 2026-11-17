import type postgres from "postgres";
import type { DrizzleError } from "drizzle-orm";
import type { plans, userPlans, users } from "../db/schema";
import type { ZodType } from "zod";

export type User = typeof users.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type UserPlan = typeof userPlans.$inferSelect;

export type ActiveUserPlan = Pick<
  Plan,
  | "id"
  | "name"
  | "slug"
  | "maxMonitors"
  | "minIntervalMinutes"
  | "logRetentionDays"
  | "webhookAlertsEnabled"
> &
  Pick<UserPlan, "status" | "currentPeriodEnd">;

export type UserWithPlan = User & {
  plan: ActiveUserPlan | null;
};

declare global {
  var _postgresClient: ReturnType<typeof postgres> | undefined;
  namespace Express {
    interface Request {
      sessionId?: string;
      user?: UserWithPlan;
    }
  }
}

export type Schemas = {
  query?: ZodType;
  params?: ZodType;
  body?: ZodType;
};

export interface PGWrappedError extends DrizzleError {
  cause: postgres.PostgresError;
}

export type Context = { userAgent?: string; ipAddress?: string };
