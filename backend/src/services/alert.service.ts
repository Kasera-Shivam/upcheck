import { eq } from "drizzle-orm";
import db from "../db";
import { incidents, monitors } from "../db/schema";
import { sendMail } from "../lib/mailer";
import { validatePublicUrl } from "../utils/url-validator";

type MonitorRow = typeof monitors.$inferSelect;
type IncidentRow = typeof incidents.$inferSelect;

const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ");
};

export const dispatchWebhook = async (
  webhookUrl: string,
  payload: Record<string, unknown>,
) => {
  const urlCheck = await validatePublicUrl(webhookUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl)
    throw new Error(`Blocked unsafe webhook URL: ${urlCheck.reason}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(urlCheck.normalizedUrl, {
      method: "POST",
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "UptimeMonitorBot/1.0",
      },
      body: JSON.stringify(payload),
    });
    await response.body?.cancel().catch(() => {});
    if (!response.ok)
      throw new Error(`Webhook responded with HTTP ${response.status}.`);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const sendDownAlert = async (
  monitor: MonitorRow,
  incident: IncidentRow,
): Promise<void> => {
  const formattedTime = incident.startedAt.toUTCString();
  const subject = `🔴 [DOWN] ${monitor.name} is unreachable`;
  const text = [
    `Monitor Down Alert`,
    `------------------`,
    `Monitor: ${monitor.name}`,
    `URL: ${monitor.method} ${monitor.url}`,
    `Cause: ${incident.cause}`,
    `Detected At: ${formattedTime}`,
    `Incident ID: ${incident.id}`,
  ].join("\n");
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
      <h2 style="color: #dc2626; margin-top: 0;">🔴 Monitor is DOWN</h2>
      <p>Your monitor <strong>${monitor.name}</strong> failed ${monitor.failureThreshold} consecutive check(s).</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">URL</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${monitor.method}</strong> ${monitor.url}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">Reason</td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;">${incident.cause}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">Started At</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formattedTime}</td></tr>
      </table>
      <p style="font-size: 12px; color: #888;">Incident ID: ${incident.id}</p>
    </div>
  `;
  const tasks: Promise<unknown>[] = [
    sendMail({ to: monitor.alertEmail, subject, text, html }),
  ];
  if (monitor.webhookUrl) {
    tasks.push(
      dispatchWebhook(monitor.webhookUrl, {
        content: `🔴 **${monitor.name}** is **DOWN** (${monitor.url}) — Reason: \`${incident.cause}\``,
        text: `🔴 *${monitor.name}* is *DOWN* (${monitor.url}) — Reason: \`${incident.cause}\``,
        event: "monitor.down",
        monitor: {
          id: monitor.id,
          name: monitor.name,
          slug: monitor.slug,
          url: monitor.url,
          method: monitor.method,
        },
        incident: {
          id: incident.id,
          cause: incident.cause,
          startedAt: incident.startedAt.toISOString(),
        },
      }),
    );
  }
  const results = await Promise.allSettled(tasks);
  const anySucceeded = results.some((r) => r.status === "fulfilled");
  if (anySucceeded)
    await db
      .update(incidents)
      .set({ isAlertSent: true })
      .where(eq(incidents.id, incident.id));
  results.forEach((res, idx) => {
    if (res.status === "rejected") {
      console.error(
        `[AlertService] Down alert channel #${idx} failed for monitor ${monitor.id}:`,
        res.reason,
      );
    }
  });
};

export const sendRecoveryAlert = async (
  monitor: MonitorRow,
  incident: IncidentRow,
  downtimeSeconds: number,
): Promise<void> => {
  const durationLabel = formatDuration(downtimeSeconds);
  const resolvedTime = (incident.resolvedAt ?? new Date()).toUTCString();
  const subject = `🟢 [RECOVERED] ${monitor.name} is back UP`;
  const text = [
    `Monitor Recovery Alert`,
    `----------------------`,
    `Monitor: ${monitor.name}`,
    `URL: ${monitor.method} ${monitor.url}`,
    `Total Downtime: ${durationLabel}`,
    `Resolved At: ${resolvedTime}`,
    `Incident ID: ${incident.id}`,
  ].join("\n");
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: auto; padding: 20px; border: 1px solid #dcfce7; border-radius: 8px;">
      <h2 style="color: #16a34a; margin-top: 0;">🟢 Monitor is Back UP</h2>
      <p>Your monitor <strong>${monitor.name}</strong> has recovered and is responding normally.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">URL</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${monitor.method}</strong> ${monitor.url}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">Downtime</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${durationLabel}</strong></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #555;">Resolved At</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${resolvedTime}</td></tr>
      </table>
      <p style="font-size: 12px; color: #888;">Incident ID: ${incident.id}</p>
    </div>
  `;
  const tasks: Promise<unknown>[] = [
    sendMail({
      to: monitor.alertEmail,
      subject,
      text,
      html,
    }),
  ];
  if (monitor.webhookUrl)
    tasks.push(
      dispatchWebhook(monitor.webhookUrl, {
        content: `🟢 **${monitor.name}** is back **UP** (${monitor.url}) after **${durationLabel}** downtime.`,
        text: `🟢 *${monitor.name}* is back *UP* (${monitor.url}) after *${durationLabel}* downtime.`,
        event: "monitor.recovered",
        monitor: {
          id: monitor.id,
          name: monitor.name,
          slug: monitor.slug,
          url: monitor.url,
          method: monitor.method,
        },
        incident: {
          id: incident.id,
          startedAt: incident.startedAt.toISOString(),
          resolvedAt: resolvedTime,
          downtimeSeconds,
        },
      }),
    );
  const results = await Promise.allSettled(tasks);
  results.forEach((res, idx) => {
    if (res.status === "rejected") {
      console.error(
        `[AlertService] Recovery alert channel #${idx} failed for monitor ${monitor.id}:`,
        res.reason,
      );
    }
  });
};
