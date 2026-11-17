import env from "../config/env.config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function runMigrations() {
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);
  console.log("⏳ Applying migrations from './drizzle' folder...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
    process.exit(0);
  }
}

await runMigrations();
