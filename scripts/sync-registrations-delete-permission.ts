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
 * DO NOT execute against STAGE as part of the ADMIN-DELETE-03B implementation
 * task — that is a separate, deliberate operational step.
 */

import { prisma } from "@/lib/db/prisma";
import { reconcileRegistrationsDeletePermission } from "@/lib/permissions/registrations-delete-permission-reconciliation";

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

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
