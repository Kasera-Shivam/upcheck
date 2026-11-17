CREATE TYPE "public"."currency_enum" AS ENUM('INR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."http_method_enum" AS ENUM('GET', 'POST', 'HEAD');--> statement-breakpoint
CREATE TYPE "public"."monitor_status_enum" AS ENUM('pending', 'up', 'down', 'paused');--> statement-breakpoint
CREATE TYPE "public"."provider_enum" AS ENUM('credentials', 'google');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'cancelled', 'expired', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."token_type_enum" AS ENUM('signup_registration', 'password_reset', 'email_change');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"provider" "provider_enum" NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"user_id" varchar(11) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"monitor_id" varchar(11) NOT NULL,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp (3) with time zone,
	"cause" text NOT NULL,
	"is_alert_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"url" text NOT NULL,
	"method" "http_method_enum" DEFAULT 'GET' NOT NULL,
	"interval_minutes" integer DEFAULT 5 NOT NULL,
	"timeout_seconds" integer DEFAULT 10 NOT NULL,
	"status" "monitor_status_enum" DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"failure_threshold" integer DEFAULT 2 NOT NULL,
	"alert_email" varchar(256) NOT NULL,
	"webhook_url" text,
	"last_checked_at" timestamp (3) with time zone,
	"next_check_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ping_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"monitor_id" varchar(11) NOT NULL,
	"is_up" boolean NOT NULL,
	"status_code" integer,
	"response_time_ms" integer NOT NULL,
	"error_message" text,
	"checked_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(32) NOT NULL,
	"description" text,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"currency" "currency_enum" DEFAULT 'INR' NOT NULL,
	"max_monitors" integer DEFAULT 3 NOT NULL,
	"min_interval_minutes" integer DEFAULT 5 NOT NULL,
	"log_retention_days" integer DEFAULT 1 NOT NULL,
	"webhook_alerts_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"user_id" varchar(11) NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_plans" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"user_id" varchar(11) NOT NULL,
	"plan_id" varchar(11) NOT NULL,
	"status" "subscription_status_enum" DEFAULT 'active' NOT NULL,
	"external_payment_id" varchar(128),
	"current_period_start" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_plans_external_payment_id_unique" UNIQUE("external_payment_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"username" varchar(32),
	"first_name" varchar(64) NOT NULL,
	"last_name" varchar(64),
	"name" varchar(129) GENERATED ALWAYS AS (TRIM(first_name || ' ' || COALESCE(last_name, ''))) STORED NOT NULL,
	"avatar" text,
	"email" varchar(256) NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" varchar(11) PRIMARY KEY NOT NULL,
	"identifier" varchar(256) NOT NULL,
	"token" varchar(64) NOT NULL,
	"type" "token_type_enum" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ping_logs" ADD CONSTRAINT "ping_logs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_accounts_provider_provider_id" ON "accounts" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_provider_id" ON "accounts" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_incidents_one_open_per_monitor" ON "incidents" USING btree ("monitor_id") WHERE resolved_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_incidents_monitor_id" ON "incidents" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_resolved_at" ON "incidents" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "idx_monitors_due_checks" ON "monitors" USING btree ("is_active","next_check_at");--> statement-breakpoint
CREATE INDEX "idx_monitors_user_id" ON "monitors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ping_logs_monitor_checked" ON "ping_logs" USING btree ("monitor_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_ping_logs_checked_at" ON "ping_logs" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_user_plans_one_active_per_user" ON "user_plans" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_user_plans_user_id" ON "user_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_plans_period_end" ON "user_plans" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_users_name" ON "users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_users_is_email_verified" ON "users" USING btree ("is_email_verified");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_tokens_identifier_type" ON "verification_tokens" USING btree ("identifier","type");--> statement-breakpoint
CREATE INDEX "idx_tokens_token" ON "verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_tokens_expires_at" ON "verification_tokens" USING btree ("expires_at");