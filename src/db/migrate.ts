/**
 * Minimal migration runner — no ORM, no migration framework.
 * Applies schema.sql, which is written entirely with IF NOT EXISTS / idempotent
 * DDL, so re-running it is safe. For a growing project, split schema.sql into
 * numbered files in this folder and apply them in order, tracked in a
 * `schema_migrations` table — the hook for that is left below.
 */
import fs from "fs";
import path from "path";
import { pool, query } from "../config/db";

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(name: string): Promise<boolean> {
  const result = await query<{ name: string }>(
    "SELECT name FROM schema_migrations WHERE name = $1",
    [name]
  );
  return (result.rowCount ?? 0) > 0;
}

async function markApplied(name: string): Promise<void> {
  await query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
}

async function main(): Promise<void> {
  await ensureMigrationsTable();

  const migrationName = "schema.sql";
  const alreadyRan = await alreadyApplied(migrationName);

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  console.log(`Applying ${migrationName}...`);
  await query(sql);

  if (!alreadyRan) {
    await markApplied(migrationName);
  }

  console.log("Migration complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
