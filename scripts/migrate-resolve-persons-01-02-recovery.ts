/**
 * scripts/migrate-resolve-persons-01-02-recovery.ts
 *
 * ONE-TIME migration state recovery for:
 *   20260814140000_persons_01_02_tenant_scoping_assignments
 *
 * Context
 * -------
 * The migration above failed during the PR-#409 STAGE deployment because its
 * Permission INSERT omitted `createdAt`/`updatedAt` (NOT NULL, no default).
 * PostgreSQL rolled back the full transaction, but Prisma recorded the
 * migration as "failed" in `_prisma_migrations`.  PR #410 corrected the SQL,
 * but `prisma migrate deploy` now aborts with P3009 before it can re-run the
 * corrected migration.
 *
 * Recovery action
 * ---------------
 * `prisma migrate resolve --rolled-back <id>` tells Prisma that the failed
 * migration was rolled back (which it was — PostgreSQL DDL is transactional),
 * so `migrate deploy` can schedule it for re-execution.
 *
 * Guards
 * ------
 * - Only runs when APPLY_DATABASE_MIGRATIONS === "true" (Vercel STAGE/prod).
 * - Only resolves the exact migration listed in MIGRATION_ID.
 * - Reads `prisma migrate status` first; skips if the migration is NOT in
 *   "failed" state (prevents repeated no-op calls on subsequent deploys).
 *
 * Removal
 * -------
 * Remove this script and the `db:migrate:resolve-persons-01-02-recovery`
 * entry from package.json after the first successful STAGE deployment that
 * shows both PERSONS migrations as "applied".
 */

import { execSync, spawnSync } from "child_process";

const MIGRATION_ID =
  "20260814140000_persons_01_02_tenant_scoping_assignments";

if (process.env.APPLY_DATABASE_MIGRATIONS !== "true") {
  console.log(
    "[recovery] APPLY_DATABASE_MIGRATIONS is not 'true' — skipping (local/preview environment)."
  );
  process.exit(0);
}

console.log(`[recovery] Checking migration state for: ${MIGRATION_ID}`);

// prisma migrate status exits non-zero when failed/pending migrations exist.
// Capture stdout + stderr regardless of exit code.
const statusResult = spawnSync(
  "npx",
  ["prisma", "migrate", "status"],
  { encoding: "utf8" }
);

const statusOutput =
  (statusResult.stdout ?? "") + (statusResult.stderr ?? "");

// Detect the specific migration in failed state.
// Prisma prints something like:
//   "Following migration have failed:\n  20260814140000_persons_01_02_..."
const migrationMentioned = statusOutput.includes(MIGRATION_ID);
const failedKeyword = /failed/i.test(statusOutput);

if (!migrationMentioned || !failedKeyword) {
  console.log(
    `[recovery] Migration ${MIGRATION_ID} is NOT in failed state — no action needed. Continuing to migrate deploy.`
  );
  process.exit(0);
}

console.log(
  `[recovery] Migration ${MIGRATION_ID} is recorded as failed.\n` +
    `[recovery] PostgreSQL DDL is fully transactional — the failed migration\n` +
    `[recovery] was rolled back entirely (no schema changes remain).\n` +
    `[recovery] Marking as rolled-back so migrate deploy can re-execute it...`
);

execSync(
  `npx prisma migrate resolve --rolled-back ${MIGRATION_ID}`,
  { stdio: "inherit" }
);

console.log(
  "[recovery] Migration state cleared. migrate deploy will now re-run the corrected migration."
);
