/**
 * scripts/sync-registrations-delete-permission.ts
 *
 * ADMIN-DELETE-03B — idempotent one-shot backfill script for the
 * registrations.delete permission.
 *
 * Wraps lib/permissions/registrations-delete-permission-reconciliation.ts for
 * controlled, deliberate execution against an already-seeded database.
 *
 * Usage:
 *   npx tsx scripts/sync-registrations-delete-permission.ts          # dry run
 *   npx tsx scripts/sync-registrations-delete-permission.ts --apply  # apply
 *
 * This script is safe to run multiple times (idempotent upserts). After
 * applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time — see lib/auth/session-context.ts), though the authoritative
 * resolver-backed checks (hasTenantDeletionAuthority) take effect immediately.
 *
 * POST-MERGE-C2: this script was executed against STAGE on 2026-08-12 to
 * backfill the missing registrations.delete Permission row and RolePermission
 * grants that PR #377 added to seed.ts but never applied to the live database.
 * After apply: FC Allschwil Club Admin (club_admin__fc-allschwil) holds
 * registrations.delete → "Endgültig löschen" action is now visible in the
 * Registrations Cockpit drawer for authorized users.
 */

import { prisma } from "@/lib/db/prisma";
import { reconcileRegistrationsDeletePermission } from "@/lib/permissions/registrations-delete-permission-reconciliation";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  if (apply) {
    assertOperationalMutationAllowed({
      operationId: "sync-registrations-delete-permission",
      databaseUrl: process.env.DATABASE_URL,
      explicitIntent: true,
      allowedRemoteEnvironments: ["stage"],
    });
  }

  console.log(
    dryRun
      ? "DRY RUN — no changes will be written."
      : "APPLY MODE — changes will be written.",
  );
  console.log();

  const result = await reconcileRegistrationsDeletePermission(prisma, dryRun);

  console.log("Permission row:", result.permission);
  console.log("super_admin grant:", result.superAdmin);
  console.log(
    `Tenant Club Admin roles processed: ${result.tenantClubAdminRoles.length}`,
  );

  for (const outcome of result.tenantClubAdminRoles) {
    console.log(" ", outcome.action, outcome.roleKey);
  }

  console.log();
  console.log(dryRun ? "DRY RUN complete." : "APPLY complete.");
}

main()
  .catch((err) => {
    console.error("sync-registrations-delete-permission failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
