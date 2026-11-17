ALTER TABLE "monitors" DROP CONSTRAINT "monitors_slug_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_users_username_lower" ON "users" USING btree (LOWER("username"));--> statement-breakpoint
ALTER TABLE "monitors" DROP COLUMN "slug";