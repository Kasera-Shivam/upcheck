import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { generateNanoId } from "../../utils/crypto";

export const providerEnum = pgEnum("provider_enum", ["credentials", "google"]);

export const tokenTypeEnum = pgEnum("token_type_enum", [
  "signup_registration",
  "password_reset",
  "email_change",
]);

export const currencyEnum = pgEnum("currency_enum", ["INR", "USD"]);

export const subscriptionStatusEnum = pgEnum("subscription_status_enum", [
  "active",
  "cancelled",
  "expired",
  "past_due",
]);

export const monitorStatusEnum = pgEnum("monitor_status_enum", [
  "pending",
  "up",
  "down",
  "paused",
]);

export const httpMethodEnum = pgEnum("http_method_enum", [
  "GET",
  "POST",
  "HEAD",
]);

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    username: varchar("username", { length: 32 }),
    firstName: varchar("first_name", { length: 64 }).notNull(),
    lastName: varchar("last_name", { length: 64 }),
    name: varchar("name", { length: 129 })
      .generatedAlwaysAs(
        () => sql`TRIM(first_name || ' ' || COALESCE(last_name, ''))`,
      )
      .notNull(),
    avatar: text("avatar"),
    email: varchar("email", { length: 256 }).notNull().unique(),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("uidx_users_username_lower").on(sql`LOWER(${table.username})`),
    index("idx_users_name").on(table.name),
    index("idx_users_is_email_verified").on(table.isEmailVerified),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    provider: providerEnum("provider").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    userId: varchar("user_id", { length: 11 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("uidx_accounts_provider_provider_id").on(
      table.provider,
      table.providerId,
    ),
    index("idx_accounts_provider_id").on(table.providerId),
    index("idx_accounts_user_id").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    token: varchar("token", { length: 64 }).notNull().unique(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userId: varchar("user_id", { length: 11 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    identifier: varchar("identifier", { length: 256 }).notNull(),
    token: varchar("token", { length: 64 }).notNull(),
    type: tokenTypeEnum("type").notNull(),
    attempts: integer("attempts").notNull().default(0),
    payload: jsonb("payload").$type<{
      firstName?: string;
      lastName?: string;
      passwordHash?: string;
      userId?: string;
      newEmail?: string;
      [key: string]: unknown;
    }>(),
    expiresAt: timestamp("expires_at", {
      precision: 3,
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_tokens_identifier_type").on(table.identifier, table.type),
    index("idx_tokens_token").on(table.token),
    index("idx_tokens_expires_at").on(table.expiresAt),
  ],
);

export const plans = pgTable("plans", {
  id: varchar("id", { length: 11 })
    .primaryKey()
    .$defaultFn(() => generateNanoId()),
  name: varchar("name", { length: 64 }).notNull(),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  description: text("description"),
  priceMonthly: integer("price_monthly").notNull().default(0),
  currency: currencyEnum("currency").notNull().default("INR"),
  maxMonitors: integer("max_monitors").notNull().default(3),
  minIntervalMinutes: integer("min_interval_minutes").notNull().default(5),
  logRetentionDays: integer("log_retention_days").notNull().default(1),
  webhookAlertsEnabled: boolean("webhook_alerts_enabled")
    .notNull()
    .default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});

export const userPlans = pgTable(
  "user_plans",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    userId: varchar("user_id", { length: 11 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: varchar("plan_id", { length: 11 })
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    externalPaymentId: varchar("external_payment_id", { length: 128 }).unique(),
    currentPeriodStart: timestamp("current_period_start", {
      precision: 3,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", {
      precision: 3,
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("uidx_user_plans_one_active_per_user")
      .on(table.userId)
      .where(sql`status = 'active'`),
    index("idx_user_plans_user_id").on(table.userId),
    index("idx_user_plans_period_end").on(table.currentPeriodEnd),
  ],
);

export const monitors = pgTable(
  "monitors",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    userId: varchar("user_id", { length: 11 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    url: text("url").notNull(),
    method: httpMethodEnum("method").notNull().default("GET"),
    intervalMinutes: integer("interval_minutes").notNull().default(5),
    timeoutSeconds: integer("timeout_seconds").notNull().default(10),
    status: monitorStatusEnum("status").notNull().default("pending"),
    isActive: boolean("is_active").notNull().default(true),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    failureThreshold: integer("failure_threshold").notNull().default(2),
    alertEmail: varchar("alert_email", { length: 256 }).notNull(),
    webhookUrl: text("webhook_url"),
    lastCheckedAt: timestamp("last_checked_at", {
      precision: 3,
      withTimezone: true,
    }),
    nextCheckAt: timestamp("next_check_at", {
      precision: 3,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("idx_monitors_due_checks").on(table.isActive, table.nextCheckAt),
    index("idx_monitors_user_id").on(table.userId),
  ],
);

export const pingLogs = pgTable(
  "ping_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    monitorId: varchar("monitor_id", { length: 11 })
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    isUp: boolean("is_up").notNull(),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ping_logs_monitor_checked").on(table.monitorId, table.checkedAt),
    index("idx_ping_logs_checked_at").on(table.checkedAt),
  ],
);

export const incidents = pgTable(
  "incidents",
  {
    id: varchar("id", { length: 11 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    monitorId: varchar("monitor_id", { length: 11 })
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { precision: 3, withTimezone: true }),
    cause: text("cause").notNull(),
    isAlertSent: boolean("is_alert_sent").notNull().default(false),
  },
  (table) => [
    uniqueIndex("uidx_incidents_one_open_per_monitor")
      .on(table.monitorId)
      .where(sql`resolved_at IS NULL`),
    index("idx_incidents_monitor_id").on(table.monitorId),
    index("idx_incidents_resolved_at").on(table.resolvedAt),
  ],
);
