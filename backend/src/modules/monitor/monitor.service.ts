import {
  and,
  avg,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { UserWithPlan } from "../../@types";
import db from "../../db";
import type {
  CreateMonitorSchema,
  DeleteMonitorSchema,
  GetMonitorIncidentsQuerySchema,
  GetMonitorListQuerySchema,
  GetMonitorLogsQuerySchema,
  UpdateMonitorSchema,
} from "./monitor.schema";
import createHttpError from "http-errors";
import { incidents, monitors, pingLogs } from "../../db/schema";
import { validatePublicUrl } from "../../utils/url-validator";
import { getPaginationMeta, getPaginationVar } from "../../utils/pagination";
import type { NanoId } from "../../schemas/common.schema";

const createMonitor = async (
  user: UserWithPlan,
  input: CreateMonitorSchema,
) => {
  const plan = user.plan;
  if (!plan || plan.status !== "active")
    throw new createHttpError.Forbidden(
      "An active subscription plan is required to create monitors.",
    );
  if (input.intervalMinutes < plan.minIntervalMinutes)
    throw new createHttpError.Forbidden(
      `Your ${plan.name} plan allows a minimum check interval of ${plan.minIntervalMinutes} minute(s).`,
    );
  if (input.webhookUrl && !plan.webhookAlertsEnabled)
    throw new createHttpError.Forbidden(
      `Webhook alerts are not available on the ${plan.name} plan. Please upgrade to enable webhooks.`,
    );
  const [[monitorCountRow], urlCheck, webhookCheck] = await Promise.all([
    db
      .select({ value: count() })
      .from(monitors)
      .where(eq(monitors.userId, user.id)),
    validatePublicUrl(input.url),
    input.webhookUrl
      ? validatePublicUrl(input.webhookUrl)
      : Promise.resolve(null),
  ]);
  const currentCount = monitorCountRow?.value ?? 0;
  if (currentCount >= plan.maxMonitors)
    throw new createHttpError.Forbidden(
      `You have reached the limit of ${plan.maxMonitors} monitor(s) on your ${plan.name} plan.`,
    );
  if (!urlCheck.valid || !urlCheck.normalizedUrl)
    throw new createHttpError.BadRequest(
      urlCheck.reason ?? "Invalid target URL.",
    );
  if (webhookCheck && (!webhookCheck.valid || !webhookCheck.normalizedUrl))
    throw new createHttpError.BadRequest(
      `Webhook URL error: ${webhookCheck.reason ?? "Invalid webhook URL."}`,
    );
  const [newMonitor] = await db
    .insert(monitors)
    .values({
      userId: user.id,
      name: input.name,
      url: urlCheck.normalizedUrl,
      method: input.method,
      intervalMinutes: input.intervalMinutes,
      timeoutSeconds: input.timeoutSeconds,
      failureThreshold: input.failureThreshold,
      alertEmail: input.alertEmail ?? user.email,
      webhookUrl: webhookCheck?.normalizedUrl ?? null,
      status: "pending",
      isActive: true,
      nextCheckAt: new Date(),
    })
    .returning();
  return newMonitor;
};

const getMonitorList = async (
  userId: NanoId,
  query: GetMonitorListQuerySchema,
) => {
  const { search, status } = query;
  const { page, limit, skip } = getPaginationVar({
    page: query.page,
    limit: query.limit,
  });
  const conditions = [eq(monitors.userId, userId)];
  if (status) conditions.push(eq(monitors.status, status));
  if (search) {
    const escapedSearch = search.replace(/[%_\\]/g, "\\$&");
    conditions.push(
      or(
        ilike(monitors.name, `%${escapedSearch}%`),
        ilike(monitors.url, `%${escapedSearch}%`),
      )!,
    );
  }
  const whereClause = and(...conditions);
  const [items, { pagination }] = await Promise.all([
    db
      .select()
      .from(monitors)
      .where(whereClause)
      .orderBy(desc(monitors.createdAt))
      .limit(limit)
      .offset(skip),
    getPaginationMeta({ table: monitors, where: whereClause, page, limit }),
  ]);
  return { monitors: items, pagination };
};

const getMonitorDetails = async (userId: NanoId, monitorId: NanoId) => {
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);
  if (!monitor) throw new createHttpError.NotFound("Monitor not found.");
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentLogs, recentIncidents, [statsRow]] = await Promise.all([
    await db
      .select()
      .from(pingLogs)
      .where(eq(pingLogs.monitorId, monitor.id))
      .orderBy(desc(pingLogs.checkedAt))
      .limit(50),
    db
      .select()
      .from(incidents)
      .where(eq(incidents.monitorId, monitor.id))
      .orderBy(desc(incidents.startedAt))
      .limit(10),
    db
      .select({
        totalPings: count(),
        successfulPings: count(
          sql`CASE WHEN ${pingLogs.isUp} = true THEN 1 END`,
        ),
        avgResponseTimeMs: avg(pingLogs.responseTimeMs),
      })
      .from(pingLogs)
      .where(
        and(
          eq(pingLogs.monitorId, monitor.id),
          gte(pingLogs.checkedAt, last24Hours),
        ),
      ),
  ]);
  const totalPings = statsRow?.totalPings ?? 0;
  const successfulPings = statsRow?.successfulPings ?? 0;
  const uptimePercentage24h =
    totalPings > 0
      ? Number(((successfulPings / totalPings) * 100).toFixed(2))
      : null;
  const avgResponseTimeMs24h = statsRow?.avgResponseTimeMs
    ? Math.round(Number(statsRow.avgResponseTimeMs))
    : null;
  return {
    monitor,
    stats: {
      uptimePercentage24h,
      avgResponseTimeMs24h,
      totalPings24h: totalPings,
    },
    recentLogs,
    recentIncidents,
  };
};

const getMonitorLogs = async (
  user: UserWithPlan,
  monitorId: NanoId,
  query: GetMonitorLogsQuerySchema,
) => {
  const [monitor] = await db
    .select({ id: monitors.id })
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, user.id)))
    .limit(1);
  if (!monitor) throw new createHttpError.NotFound("Monitor not found.");
  const { page, limit, skip } = getPaginationVar({
    page: query.page,
    limit: query.limit,
  });
  const retentionDays = user.plan?.logRetentionDays ?? 1;
  const retentionCutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );
  const conditions = [
    eq(pingLogs.monitorId, monitor.id),
    gte(pingLogs.checkedAt, retentionCutoff),
  ];
  if (query.status === "up") conditions.push(eq(pingLogs.isUp, true));
  if (query.status === "down") conditions.push(eq(pingLogs.isUp, false));
  const whereClause = and(...conditions);
  const [logs, { pagination }] = await Promise.all([
    db
      .select()
      .from(pingLogs)
      .where(whereClause)
      .orderBy(desc(pingLogs.checkedAt))
      .limit(limit)
      .offset(skip),
    getPaginationMeta({ table: pingLogs, where: whereClause, page, limit }),
  ]);
  return { logs, pagination };
};

const getMonitorIncidents = async (
  userId: NanoId,
  monitorId: NanoId,
  query: GetMonitorIncidentsQuerySchema,
) => {
  const [monitor] = await db
    .select({ id: monitors.id })
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);
  if (!monitor) throw new createHttpError.NotFound("Monitor not found.");
  const { page, limit, skip } = getPaginationVar({
    page: query.page,
    limit: query.limit,
  });
  const conditions = [eq(incidents.monitorId, monitor.id)];
  if (query.status === "open") conditions.push(isNull(incidents.resolvedAt));
  if (query.status === "resolved")
    conditions.push(isNotNull(incidents.resolvedAt));
  const whereClause = and(...conditions);
  const [items, { pagination }] = await Promise.all([
    db
      .select()
      .from(incidents)
      .where(whereClause)
      .orderBy(desc(incidents.startedAt))
      .limit(limit)
      .offset(skip),
    getPaginationMeta({ table: incidents, where: whereClause, page, limit }),
  ]);
  const formattedIncidents = items.map((incident) => {
    const endTime = incident.resolvedAt ?? new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((endTime.getTime() - incident.startedAt.getTime()) / 1000),
    );
    return { ...incident, durationSeconds };
  });
  return { incidents: formattedIncidents, pagination };
};

const getPublicMonitorStatus = async (monitorId: NanoId) => {
  const [monitor] = await db
    .select({
      id: monitors.id,
      name: monitors.name,
      status: monitors.status,
      isActive: monitors.isActive,
      intervalMinutes: monitors.intervalMinutes,
      lastCheckedAt: monitors.lastCheckedAt,
      createdAt: monitors.createdAt,
    })
    .from(monitors)
    .where(eq(monitors.id, monitorId))
    .limit(1);
  if (!monitor) throw new createHttpError.NotFound("Status page not found.");
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentChecks, recentIncidents, [statsRow]] = await Promise.all([
    db
      .select({
        isUp: pingLogs.isUp,
        statusCode: pingLogs.statusCode,
        responseTimeMs: pingLogs.responseTimeMs,
        checkedAt: pingLogs.checkedAt,
      })
      .from(pingLogs)
      .where(eq(pingLogs.monitorId, monitor.id))
      .orderBy(desc(pingLogs.checkedAt))
      .limit(40),
    db
      .select({
        id: incidents.id,
        startedAt: incidents.startedAt,
        resolvedAt: incidents.resolvedAt,
        cause: incidents.cause,
      })
      .from(incidents)
      .where(eq(incidents.monitorId, monitor.id))
      .orderBy(desc(incidents.startedAt))
      .limit(5),
    db
      .select({
        totalPings: count(),
        successfulPings: count(
          sql`CASE WHEN ${pingLogs.isUp} = true THEN 1 END`,
        ),
        avgResponseTimeMs: avg(pingLogs.responseTimeMs),
      })
      .from(pingLogs)
      .where(
        and(
          eq(pingLogs.monitorId, monitor.id),
          gte(pingLogs.checkedAt, last24Hours),
        ),
      ),
  ]);
  const totalPings = statsRow?.totalPings ?? 0;
  const successfulPings = statsRow?.successfulPings ?? 0;
  const uptimePercentage24h =
    totalPings > 0
      ? Number(((successfulPings / totalPings) * 100).toFixed(2))
      : null;
  const avgResponseTimeMs24h = statsRow?.avgResponseTimeMs
    ? Math.round(Number(statsRow.avgResponseTimeMs))
    : null;
  const formattedIncidents = recentIncidents.map((incident) => {
    const endTime = incident.resolvedAt ?? new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((endTime.getTime() - incident.startedAt.getTime()) / 1000),
    );
    return { ...incident, durationSeconds };
  });
  return {
    monitor,
    stats: { uptimePercentage24h, avgResponseTimeMs24h },
    recentChecks,
    recentIncidents: formattedIncidents,
  };
};

const updateMonitor = async (
  user: UserWithPlan,
  monitorId: NanoId,
  input: UpdateMonitorSchema,
) => {
  const plan = user.plan;
  if (!plan || plan.status !== "active")
    throw new createHttpError.Forbidden("Active subscription plan required.");
  if (input.intervalMinutes && input.intervalMinutes < plan.minIntervalMinutes)
    throw new createHttpError.Forbidden(
      `Your ${plan.name} plan allows a minimum check interval of ${plan.minIntervalMinutes} minute(s).`,
    );
  if (input.webhookUrl && !plan.webhookAlertsEnabled)
    throw new createHttpError.Forbidden(
      `Webhook alerts are not available on the ${plan.name} plan.`,
    );
  const [existing] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, user.id)))
    .limit(1);
  if (!existing) throw new createHttpError.NotFound("Monitor not found.");
  const [urlCheck, webhookCheck] = await Promise.all([
    input.url ? validatePublicUrl(input.url) : Promise.resolve(null),
    input.webhookUrl
      ? validatePublicUrl(input.webhookUrl)
      : Promise.resolve(null),
  ]);
  if (urlCheck && (!urlCheck.valid || !urlCheck.normalizedUrl))
    throw new createHttpError.BadRequest(
      urlCheck.reason ?? "Invalid target URL.",
    );
  if (webhookCheck && (!webhookCheck.valid || !webhookCheck.normalizedUrl))
    throw new createHttpError.BadRequest(
      `Webhook URL error: ${webhookCheck.reason ?? "Invalid webhook URL."}`,
    );
  const isTargetChanged =
    (urlCheck?.normalizedUrl && urlCheck.normalizedUrl !== existing.url) ||
    (input.method && input.method !== existing.method);
  const [updatedMonitor] = await db
    .update(monitors)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(urlCheck?.normalizedUrl && { url: urlCheck.normalizedUrl }),
      ...(input.method !== undefined && { method: input.method }),
      ...(input.intervalMinutes !== undefined && {
        intervalMinutes: input.intervalMinutes,
      }),
      ...(input.timeoutSeconds !== undefined && {
        timeoutSeconds: input.timeoutSeconds,
      }),
      ...(input.failureThreshold !== undefined && {
        failureThreshold: input.failureThreshold,
      }),
      ...(input.alertEmail !== undefined && { alertEmail: input.alertEmail }),
      ...(input.webhookUrl !== undefined && {
        webhookUrl: webhookCheck?.normalizedUrl ?? null,
      }),
      ...(isTargetChanged &&
        existing.isActive && {
          status: "pending",
          consecutiveFailures: 0,
          nextCheckAt: new Date(),
        }),
    })
    .where(eq(monitors.id, monitorId))
    .returning();
  return updatedMonitor;
};

export const toggleMonitor = async (userId: NanoId, monitorId: NanoId) => {
  const [existing] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);
  if (!existing) throw new createHttpError.NotFound("Monitor not found.");
  const nextActiveState = !existing.isActive;
  const [updatedMonitor] = await db
    .update(monitors)
    .set({
      isActive: nextActiveState,
      status: nextActiveState ? "pending" : "paused",
      consecutiveFailures: 0,
      ...(nextActiveState && { nextCheckAt: new Date() }),
    })
    .where(eq(monitors.id, monitorId))
    .returning();
  return updatedMonitor;
};

const deleteMonitor = async (
  userId: NanoId,
  monitorId: NanoId,
  { name }: DeleteMonitorSchema,
) => {
  const [existing] = await db
    .select({ id: monitors.id, name: monitors.name })
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);
  if (!existing) throw new createHttpError.NotFound("Monitor not found.");
  if (existing.name !== name)
    throw new createHttpError.BadRequest(
      "Confirmation name does not match this monitor.",
    );
  await db.delete(monitors).where(eq(monitors.id, monitorId));
};

export default {
  createMonitor,
  getMonitorList,
  getMonitorDetails,
  getMonitorLogs,
  getMonitorIncidents,
  getPublicMonitorStatus,
  updateMonitor,
  toggleMonitor,
  deleteMonitor,
};
