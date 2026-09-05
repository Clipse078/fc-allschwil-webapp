/**
 * scripts/sync-teams-delete-permission.ts
 *
 * ADMIN-DELETE-01A-C1 — Idempotent teams.delete permission backfill.
 *
 * CLI wrapper around lib/permissions/teams-delete-permission-reconciliation.ts.
 * The reconciliation logic is tested independently in:
 *   lib/permissions/__tests__/teams-delete-permission-reconciliation.test.ts
 *
 * Ensures:
 *   - the `teams.delete` Permission row exists (module=TEAMS, scope=TENANT,
 *     grantableByAdmin=true)
 *   - `super_admin` (PLATFORM) holds it
 *   - every already-materialized per-tenant Club Admin role holds it
 *   - ADMIN-DELETE-01B-C1: the narrow, already-known FC Allschwil legacy
 *     Club Admin role (`club_admin_fc_allschwil`) holds it too, IF it exists
 *     in this database with scope=TENANT and is owned by the real
 *     fc-allschwil tenant (never touched otherwise) — see
 *     lib/permissions/teams-delete-permission-reconciliation.ts's module doc
 *     comment ("Step 4") for the full trusted-attribute rationale.
 *
 * Root cause this script fixes: prisma/seed.ts is not automatically re-run
 * after a deploy (see package.json's `build` script), so any STAGE/
 * production database seeded before the ADMIN-DELETE-01A commit added
 * `teams.delete` to prisma/seed.ts is missing this permission and its role
 * grants entirely — mirrors the exact gap
 * scripts/sync-training-permissions.ts fixed for trainings.view/manage.
 *
 * Defaults to DRY RUN — shows what would change without touching the database.
 * Set APPLY_PERMISSION_SYNC=true to perform actual writes (all via upsert —
 * safe to re-run as many times as needed).
 *
 * Loads environment via @next/env so .env.local is respected.
 *
 * Requirements:
 *   DIRECT_DATABASE_URL or DATABASE_URL — connection string for the target database
 *
 * Usage (dry run — default):
 *   npx tsx scripts/sync-teams-delete-permission.ts
 *
 * Usage (apply):
 *   APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-teams-delete-permission.ts
 *
 * After applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time via the credentials authorize() callback).
 */

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { reconcileTeamsDeletePermission } from "@/lib/permissions/teams-delete-permission-reconciliation";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

// ── Mode ───────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.APPLY_PERMISSION_SYNC !== "true";

// ── Safety check ───────────────────────────────────────────────────────────────

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[sync-teams-delete-permission] ERROR: Neither DIRECT_DATABASE_URL nor DATABASE_URL is set."
  );
  process.exit(1);
}

if (!DRY_RUN) {
  assertOperationalMutationAllowed({
    operationId: "sync-teams-delete-permission",
    databaseUrl: connectionString,
    explicitIntent: process.env.APPLY_PERMISSION_SYNC === "true",
    allowedRemoteEnvironments: ["stage"],
  });
}

// ── Client ─────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n[sync-teams-delete-permission] Starting… (mode: ${DRY_RUN ? "DRY RUN" : "APPLY"})\n`
  );

  const result = await reconcileTeamsDeletePermission(prisma, DRY_RUN);

  console.log("── Permission ─────────────────────────────────────────────────");
  const p = result.permission;
  const pMarker = p.action === "created" ? "+" : p.action === "updated" ? "~" : "✓";
  const pLabel =
    p.action === "created" ? "would create" : p.action === "updated" ? "would update" : "already up-to-date";
  console.log(`  ${pMarker}  ${p.key} — ${pLabel}`);

  console.log("\n── Role assignments ────────────────────────────────────────────");
  const roleAssignmentOutcomes = [result.superAdmin, ...result.tenantClubAdminRoles];
  if (result.fcAllschwilLegacyClubAdmin) {
    roleAssignmentOutcomes.push(result.fcAllschwilLegacyClubAdmin);
  }
  for (const outcome of roleAssignmentOutcomes) {
    if (outcome.action === "role_not_found") {
      console.log(`  ?  Role not found: ${outcome.roleKey} — skipping`);
    } else if (outcome.action === "permission_not_in_db") {
      console.log(`  ?  Permission not in DB yet: ${outcome.permissionKey} for ${outcome.roleKey} — will be assigned in apply mode`);
    } else if (outcome.action === "assigned") {
      console.log(`  +  ${outcome.roleKey} → ${outcome.permissionKey} — would assign`);
    } else {
      console.log(`  ✓  ${outcome.roleKey} → ${outcome.permissionKey} — already assigned`);
    }
  }

  if (result.tenantClubAdminRoles.length === 0) {
    console.log("  (no already-materialized tenant Club Admin roles found)");
  }

  // ADMIN-DELETE-01B-C1: narrow FC Allschwil legacy Club Admin compatibility
  // grant — reported separately since it is not covered by the canonical
  // club_admin__ prefix search above, and `null` is an expected, benign
  // outcome on any database where that specific legacy role doesn't exist.
  if (!result.fcAllschwilLegacyClubAdmin) {
    console.log(
      "  (FC Allschwil legacy Club Admin role not recognized in this database — nothing to grant)"
    );
  }

  if (DRY_RUN) {
    console.log(
      "\n[sync-teams-delete-permission] DRY RUN complete — no database changes were made."
    );
    console.log(
      "  To apply: APPLY_PERMISSION_SYNC=true npx tsx scripts/sync-teams-delete-permission.ts\n"
    );
  } else {
    console.log(
      "\n[sync-teams-delete-permission] Done. teams.delete synced successfully.\n"
    );
    console.log(
      "  NOTE: Users must log out and log back in for the new permission to appear\n" +
      "        in their session JWT. Permissions are embedded at sign-in time and\n" +
      "        are not refreshed automatically between sessions. Authoritative\n" +
      "        server-side checks (requireApiPermission, hasTenantDeletionAuthority)\n" +
      "        take effect immediately regardless.\n"
    );
  }
}

main()
  .catch((err) => {
    console.error(
      "[sync-teams-delete-permission] FAILED:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
