/**
 * scripts/sync-workspace-delete-permission.ts
 *
 * ADMIN-DELETE-03A — idempotent one-shot backfill script for the
 * workspace.delete permission.
 *
 * Wraps lib/permissions/workspace-delete-permission-reconciliation.ts for
 * controlled, deliberate execution against an already-seeded database.
 *
 * Usage:
 *   npx tsx scripts/sync-workspace-delete-permission.ts          # dry run
 *   npx tsx scripts/sync-workspace-delete-permission.ts --apply  # apply
 *
 * This script is safe to run multiple times (idempotent upserts). After
 * applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time — see lib/auth/session-context.ts), though the authoritative
 * resolver-backed checks (hasTenantDeletionAuthority) take effect immediately.
 *
 * DO NOT execute against STAGE as part of the ADMIN-DELETE-03A implementation
 * task — that is a separate, deliberate operational step.
 */

import { prisma } from "@/lib/db/prisma";
import { reconcileWorkspaceDeletePermission } from "@/lib/permissions/workspace-delete-permission-reconciliation";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  if (apply) {
    assertOperationalMutationAllowed({
      operationId: "sync-workspace-delete-permission",
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

  const result = await reconcileWorkspaceDeletePermission(prisma, dryRun);

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
    console.error("sync-workspace-delete-permission failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
