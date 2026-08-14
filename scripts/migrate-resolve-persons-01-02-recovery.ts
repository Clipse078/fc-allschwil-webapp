/**
 * scripts/migrate-resolve-persons-01-02-recovery.ts
 *
 * ONE-TIME deterministic migration state recovery for:
 *   20260814140000_persons_01_02_tenant_scoping_assignments
 *
 * Root cause (discovered during manual recovery)
 * -----------------------------------------------
 * The migration's DDL statements (ALTER TABLE, CREATE INDEX) were
 * committed individually because the original deploy ran through
 * Neon pgBouncer (transaction-per-statement mode) rather than the
 * direct connection.  Only the final INSERT INTO Permission failed,
 * leaving the schema changes in the DB but the migration recorded as
 * "failed" in _prisma_migrations.
 *
 * Correct recovery sequence
 * -------------------------
 * Step 1: migrate resolve --rolled-back
 *   Clears P3009 "failed migration" error so Prisma can proceed.
 *   (Error is caught silently when migration is already resolved.)
 *
 * Step 2: migrate resolve --applied
 *   Tells Prisma the DDL is in the database so it does not attempt
 *   to re-run ADD COLUMN statements that already exist, which would
 *   fail with "column already exists" (code 42701).
 *   (Error is caught silently when migration is already applied.)
 *
 * After both steps, migrate deploy applies 20260814150000 (C1), which
 * includes the missing Permission INSERT with ON CONFLICT DO NOTHING.
 *
 * Guard
 * -----
 * Only runs when APPLY_DATABASE_MIGRATIONS === "true" (Vercel STAGE/prod).
 * Silent no-op locally and in preview deployments.
 *
 * Idempotence on subsequent deploys
 * ----------------------------------
 * Once both PERSONS migrations are "applied", both migrate resolve
 * calls exit non-zero. Both errors are caught; execution continues.
 * migrate deploy sees all migrations applied and exits 0. Safe.
 *
 * Removal
 * -------
 * Remove this script and its package.json entries AFTER the first
 * successful Vercel STAGE deployment confirms both PERSONS migrations
 * as "applied".
 */

import { execSync } from "child_process";

const MIGRATION_ID =
  "20260814140000_persons_01_02_tenant_scoping_assignments";

if (process.env.APPLY_DATABASE_MIGRATIONS !== "true") {
  console.log(
    "[PERSONS RECOVERY] APPLY_DATABASE_MIGRATIONS is not 'true' — skipping (not a migration-enabled deployment)."
  );
  process.exit(0);
}

// Step 1: resolve --rolled-back to clear any P3009 "failed migration" error.
console.log(
  `[PERSONS RECOVERY] Resolving failed migration as rolled back: ${MIGRATION_ID}`
);
try {
  execSync(
    `npx prisma migrate resolve --rolled-back ${MIGRATION_ID}`,
    { stdio: "inherit" }
  );
  console.log("[PERSONS RECOVERY] Migration resolved (rolled-back).");
} catch (err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.log(
    "[PERSONS RECOVERY] --rolled-back exited non-zero (migration not in failed state — already resolved or applied). Continuing.\n" +
      `[PERSONS RECOVERY] Detail: ${detail}`
  );
}

// Step 2: resolve --applied because the DDL committed to the DB (pgBouncer
// transaction-per-statement) even though the migration was recorded as failed.
// Without this, migrate deploy would try to re-run ADD COLUMN and fail with
// "column already exists" (PostgreSQL error code 42701).
console.log(
  `[PERSONS RECOVERY] Marking migration as applied (DDL already in DB): ${MIGRATION_ID}`
);
try {
  execSync(
    `npx prisma migrate resolve --applied ${MIGRATION_ID}`,
    { stdio: "inherit" }
  );
  console.log("[PERSONS RECOVERY] Migration resolved (applied).");
} catch (err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.log(
    "[PERSONS RECOVERY] --applied exited non-zero (migration already in applied state — subsequent deploy). Continuing.\n" +
      `[PERSONS RECOVERY] Detail: ${detail}`
  );
}
