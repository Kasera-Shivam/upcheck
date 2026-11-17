import cron from "node-cron";
import { and, eq, isNull, lte } from "drizzle-orm";
import db from "../db";
import { incidents, monitors, pingLogs } from "../db/schema";
import { executeHttpPing } from "./ping-executor";
import { sendDownAlert, sendRecoveryAlert } from "../services/alert.service";

type MonitorRow = typeof monitors.$inferSelect;

const BATCH_SIZE = 50;
const CONCURRENCY_LIMIT = 10;

let isWorkerRunning = false;

const claimDueMonitors = async (): Promise<MonitorRow[]> =>
  await db.transaction(async (tx) => {
    const dueRows = await tx
      .select()
      .from(monitors)
      .where(
        and(eq(monitors.isActive, true), lte(monitors.nextCheckAt, new Date())),
      )
      .orderBy(monitors.nextCheckAt)
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    if (dueRows.length === 0) return [];
    await Promise.all(
      dueRows.map((monitor) =>
        tx
          .update(monitors)
          .set({
            nextCheckAt: new Date(
              Date.now() + monitor.intervalMinutes * 60 * 1000,
            ),
          })
          .where(eq(monitors.id, monitor.id)),
      ),
    );
    return dueRows;
  });

const processSingleMonitor = async (monitor: MonitorRow): Promise<void> => {
  const checkedAt = new Date();
  const result = await executeHttpPing({
    url: monitor.url,
    method: monitor.method,
    timeoutSeconds: monitor.timeoutSeconds,
  });
  await db.insert(pingLogs).values({
    monitorId: monitor.id,
    ...result,
    checkedAt,
  });
  if (result.isUp) {
    const wasDown = monitor.status === "down";
    await db
      .update(monitors)
      .set({ status: "up", consecutiveFailures: 0, lastCheckedAt: checkedAt })
      .where(
        and(
          eq(monitors.id, monitor.id),
          eq(monitors.isActive, true),
          eq(monitors.url, monitor.url),
          eq(monitors.method, monitor.method),
        ),
      );
    if (wasDown) {
      const [resolvedIncident] = await db
        .update(incidents)
        .set({
          resolvedAt: checkedAt,
        })
        .where(
          and(
            eq(incidents.monitorId, monitor.id),
            isNull(incidents.resolvedAt),
          ),
        )
        .returning();

      if (resolvedIncident) {
        const downtimeSeconds = Math.max(
          1,
          Math.round(
            (checkedAt.getTime() - resolvedIncident.startedAt.getTime()) / 1000,
          ),
        );
        await sendRecoveryAlert(monitor, resolvedIncident, downtimeSeconds);
        console.log(
          `[RECOVERY] Monitor "${monitor.name}" is back UP after ${downtimeSeconds}s!`,
        );
      }
    }
    return;
  }
  const newFailureCount = monitor.consecutiveFailures + 1;
  const reachedThreshold = newFailureCount >= monitor.failureThreshold;
  const isNewlyDown = reachedThreshold && monitor.status !== "down";
  await db
    .update(monitors)
    .set({
      consecutiveFailures: newFailureCount,
      lastCheckedAt: checkedAt,
      ...(reachedThreshold && { status: "down" }),
    })
    .where(eq(monitors.id, monitor.id));
  if (isNewlyDown) {
    const [newIncident] = await db
      .insert(incidents)
      .values({
        monitorId: monitor.id,
        startedAt: checkedAt,
        cause: result.errorMessage ?? "Monitor check failed",
        isAlertSent: false,
      })
      .onConflictDoNothing()
      .returning();
    if (newIncident) {
      await sendDownAlert(monitor, newIncident);
      console.log(
        `[DOWN ALERT] Monitor "${monitor.name}" (${monitor.url}) is DOWN! Cause: ${newIncident.cause}`,
      );
    }
  }
};

const runPingCycle = async (): Promise<void> => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  try {
    const dueMonitors = await claimDueMonitors();
    if (dueMonitors.length === 0) return;
    for (let i = 0; i < dueMonitors.length; i += CONCURRENCY_LIMIT) {
      const chunk = dueMonitors.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.allSettled(
        chunk.map((monitor) => processSingleMonitor(monitor)),
      );
    }
  } catch (error) {
    console.error("[PingWorker] Error during ping cycle:", error);
  } finally {
    isWorkerRunning = false;
  }
};

export const startPingWorker = () => {
  cron.schedule("*/30 * * * * *", () => {
    void runPingCycle();
  });
  void runPingCycle();
  console.log("✅ Background Ping Worker started (runs every 30s).");
};
