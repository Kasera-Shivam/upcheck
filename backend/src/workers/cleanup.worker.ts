import cron from "node-cron";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import db from "../db";
import {
  monitors,
  pingLogs,
  plans,
  sessions,
  userPlans,
  verificationTokens,
} from "../db/schema";

let isCleanupRunning = false;

const downgradeExpiredPlans = async (now: Date): Promise<number> => {
  const [freePlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.priceMonthly, 0), eq(plans.isActive, true)))
    .limit(1);
  if (!freePlan) {
    console.warn(
      "[CleanupWorker] Active Free plan not found; skipping plan downgrade.",
    );
    return 0;
  }
  const expiredSubscriptions = await db
    .select({
      id: userPlans.id,
      userId: userPlans.userId,
    })
    .from(userPlans)
    .where(
      and(eq(userPlans.status, "active"), lte(userPlans.currentPeriodEnd, now)),
    );
  for (const sub of expiredSubscriptions) {
    await db.transaction(async (tx) => {
      await tx
        .update(userPlans)
        .set({ status: "expired" })
        .where(eq(userPlans.id, sub.id));
      await tx.insert(userPlans).values({
        userId: sub.userId,
        planId: freePlan.id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: null,
      });
      await tx
        .update(monitors)
        .set({ intervalMinutes: freePlan.minIntervalMinutes })
        .where(
          and(
            eq(monitors.userId, sub.userId),
            lt(monitors.intervalMinutes, freePlan.minIntervalMinutes),
          ),
        );
      if (!freePlan.webhookAlertsEnabled)
        await tx
          .update(monitors)
          .set({ webhookUrl: null })
          .where(eq(monitors.userId, sub.userId));
      const activeMonitors = await tx
        .select({ id: monitors.id })
        .from(monitors)
        .where(
          and(eq(monitors.userId, sub.userId), eq(monitors.isActive, true)),
        )
        .orderBy(asc(monitors.createdAt));
      const excessMonitorIds = activeMonitors
        .slice(freePlan.maxMonitors)
        .map((m) => m.id);
      if (excessMonitorIds.length > 0)
        await tx
          .update(monitors)
          .set({ isActive: false, status: "paused" })
          .where(inArray(monitors.id, excessMonitorIds));
    });
  }
  return expiredSubscriptions.length;
};

export const runDailyCleanup = async (): Promise<void> => {
  if (isCleanupRunning) return;
  isCleanupRunning = true;
  try {
    const now = new Date();
    const downgradedPlansCount = await downgradeExpiredPlans(now);
    const deletedSessions = await db
      .delete(sessions)
      .where(lte(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    const deletedTokens = await db
      .delete(verificationTokens)
      .where(lte(verificationTokens.expiresAt, now))
      .returning({ id: verificationTokens.id });
    const deletedLogsResult = await db.execute(sql`
      DELETE FROM ${pingLogs} AS pl
      USING monitors AS m
      LEFT JOIN user_plans AS up
        ON up.user_id = m.user_id AND up.status = 'active'
      LEFT JOIN plans AS p
        ON p.id = up.plan_id
      WHERE pl.monitor_id = m.id
        AND pl.checked_at < NOW() - (COALESCE(p.log_retention_days, 1) * INTERVAL '1 day')
    `);
    console.log(
      `🧹 [CleanupWorker] Done — Downgraded Plans: ${downgradedPlansCount}, Sessions: ${deletedSessions.length}, Tokens: ${deletedTokens.length}, Old Ping Logs: ${deletedLogsResult.length ?? 0}`,
    );
  } catch (error) {
    console.error("[CleanupWorker] Error during daily cleanup:", error);
  } finally {
    isCleanupRunning = false;
  }
};

export const startCleanupWorker = () => {
  cron.schedule("0 3 * * *", () => {
    void runDailyCleanup();
  });
  console.log("✅ Daily Cleanup Worker scheduled (runs every day at 3:00 AM).");
};
