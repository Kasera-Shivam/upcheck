import { type ActiveUserPlan } from "../@types";
import { and, eq } from "drizzle-orm";
import db from "../db";
import { plans, userPlans, users } from "../db/schema";

export const planFieldsSelect = {
  id: plans.id,
  name: plans.name,
  slug: plans.slug,
  maxMonitors: plans.maxMonitors,
  minIntervalMinutes: plans.minIntervalMinutes,
  logRetentionDays: plans.logRetentionDays,
  webhookAlertsEnabled: plans.webhookAlertsEnabled,
} as const;

export const activePlanSelect = {
  ...planFieldsSelect,
  status: userPlans.status,
  currentPeriodEnd: userPlans.currentPeriodEnd,
} as const;

type RawJoinedPlan = {
  [K in keyof typeof activePlanSelect]:
    | (typeof activePlanSelect)[K]["_"]["data"]
    | null;
};

export const mapActivePlan = (
  raw?: RawJoinedPlan | null,
): ActiveUserPlan | null => {
  if (!raw?.id || !raw.status) return null;
  return raw as ActiveUserPlan;
};

export const getUserActivePlan = async (userId: string) => {
  const [activePlan] = await db
    .select(activePlanSelect)
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, userId), eq(userPlans.status, "active")))
    .limit(1);
  return activePlan ?? null;
};

export const getUserWithPlan = async (userId: string) => {
  const [user, plan] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    getUserActivePlan(userId),
  ]);
  if (!user) return null;
  return { ...user, plan };
};
