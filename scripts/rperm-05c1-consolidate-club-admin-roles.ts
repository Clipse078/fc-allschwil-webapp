/**
 * scripts/rperm-05c1-consolidate-club-admin-roles.ts
 *
 * RPERM-05-C1 — Finding 1: consolidates divergent tenant Club Admin role
 * identities for a single tenant into the one canonical role identified by
 * `getTenantClubAdminRoleKey(tenantKey)` (lib/roles/tenant-role-keys.ts).
 *
 * Background: prior to RPERM-05-C1, `prisma/seed.ts` and
 * `scripts/rperm-03b-bootstrap-admin-separation.ts` independently
 * constructed two different role keys for "FC Allschwil Club Admin"
 * (`club_admin__fc-allschwil`, isSystem=true vs. `club_admin_fc_allschwil`,
 * isSystem=false). Both scripts now resolve the same canonical key, so a
 * FRESH database never diverges again — but any database that already has
 * both rows (a pre-existing local/STAGE database bootstrapped before this
 * fix) needs this script to merge them.
 *
 * Modes:
 *   --inspect   Read-only: report the canonical role + any duplicate(s).
 *   --dry-run   Read-only: exact merge plan (permissions/users to move).
 *               Zero DB writes.
 *   --execute   Live execution, transactional. Requires
 *               --confirm CONSOLIDATE-CLUB-ADMIN-ROLES
 *
 * Usage:
 *   DATABASE_URL=<local disposable db> \
 *     npx tsx scripts/rperm-05c1-consolidate-club-admin-roles.ts \
 *     --tenant-key fc-allschwil --inspect
 *
 *   ... --dry-run
 *
 *   ... --execute --confirm CONSOLIDATE-CLUB-ADMIN-ROLES
 *
 * Safety properties (all covered by scripts/__tests__/rperm-05c1-*):
 *   - Idempotent: re-running with no remaining duplicates is a no-op.
 *   - Transactional: the whole merge (permission copy, UserRole move,
 *     duplicate archive, canonical self-heal) runs inside one
 *     `prisma.$transaction`; any postcondition failure rolls back
 *     everything.
 *   - Tenant-specific: every candidate role query is scoped to the
 *     resolved tenant's id — a role belonging to a different tenant, even
 *     with an identical name, is never touched (checked twice: once in the
 *     query `where` clause, once explicitly before every write).
 *   - Never deletes a role row outright — the duplicate is archived
 *     (`isArchived: true`, its now-redundant RolePermission rows removed)
 *     only AFTER its permissions/users have been copied to the canonical
 *     role in the same transaction, so a rollback can never lose data.
 *   - Safe if only one role exists (no-op, canonical self-heals isSystem
 *     drift), safe if neither role exists (no-op), safe if the two roles
 *     have different permissions/users (both are merged/moved), safe if
 *     they have overlapping users (never creates a duplicate UserRole row).
 *   - Refuses to run --execute against a DATABASE_URL that looks like
 *     production. This task's own execution is only ever performed
 *     against a disposable local database — never STAGE_DB_URL, never
 *     STAGE itself.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleScope } from "@prisma/client";
import { Pool } from "pg";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_ROLE_NAME = "Club Admin";
export const EXECUTE_CONFIRMATION = "CONSOLIDATE-CLUB-ADMIN-ROLES";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleCandidate {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  tenantId: string | null;
  isSystem: boolean;
  isArchived: boolean;
  permissionKeys: string[];
  userIds: string[];
}

export interface TenantSummary {
  exists: boolean;
  id?: string;
  key?: string;
  name?: string;
}

export interface InspectResult {
  tenant: TenantSummary;
  roleName: string;
  canonicalKey: string;
  canonical: RoleCandidate | null;
  duplicates: RoleCandidate[];
}

export type NoOpReason = "TENANT_NOT_FOUND" | "NO_DUPLICATES_FOUND" | null;

export interface ConsolidationPlan {
  tenantKey: string;
  roleName: string;
  canonicalKey: string;
  tenantFound: boolean;
  canonicalRoleExists: boolean;
  willCreateCanonicalRole: boolean;
  legacyRoleKeys: string[];
  legacyRoleIds: string[];
  permissionKeysToMerge: string[];
  userIdsToMove: string[];
  noOpReason: NoOpReason;
  conflicts: string[];
}

export interface ConsolidationCounts {
  canonicalPermissionCount: number;
  canonicalUserCount: number;
  duplicateCount: number;
}

export interface ConsolidationResult {
  tenantKey: string;
  tenantId: string | null;
  roleName: string;
  canonicalKey: string;
  canonicalRoleId: string | null;
  canonicalRoleCreated: boolean;
  legacyRoleIds: string[];
  legacyRolesArchived: string[];
  permissionsMergedCount: number;
  userAssignmentsMovedCount: number;
  dryRun: boolean;
  completed: boolean;
  noOp: boolean;
  before: ConsolidationCounts;
  after: ConsolidationCounts;
  postconditions: Array<{ check: string; passed: boolean; detail: string }>;
}

// ---------------------------------------------------------------------------
// Shared env helpers (same convention as the other RPERM bootstrap scripts)
// ---------------------------------------------------------------------------

export function detectEnvironment(url: string | undefined): string {
  if (!url) return "UNKNOWN";
  const l = url.toLowerCase();
  if (l.includes("prod")) return "PROD";
  if (l.includes("stage")) return "STAGE";
  if (l.includes("localhost") || l.includes("127.0.0.1")) return "LOCAL";
  return "EXTERNAL";
}

export function maskUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const db = parsed.pathname;
    const user = parsed.username || "(no user)";
    return `${parsed.protocol}//${user}:***@${host}${db}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

export function createPrismaClient(connectionString: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

// ---------------------------------------------------------------------------
// Candidate loading (read-only — shared by inspect/dry-run)
// ---------------------------------------------------------------------------

type CandidateRow = {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  tenantId: string | null;
  isSystem: boolean;
  isArchived: boolean;
  rolePermissions: { permission: { key: string } }[];
  userRoles: { userId: string }[];
};

function toCandidate(role: CandidateRow): RoleCandidate {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    scope: role.scope,
    tenantId: role.tenantId,
    isSystem: role.isSystem,
    isArchived: role.isArchived,
    permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
    userIds: Array.from(new Set(role.userRoles.map((ur) => ur.userId))),
  };
}

const SUMMARY_SELECT = {
  id: true,
  key: true,
  name: true,
  scope: true,
  tenantId: true,
  isSystem: true,
  isArchived: true,
  rolePermissions: { select: { permission: { select: { key: true } } } },
  userRoles: { select: { userId: true } },
} as const;

type PrismaLike = {
  tenant: { findUnique: PrismaClient["tenant"]["findUnique"] };
  role: {
    findFirst: PrismaClient["role"]["findFirst"];
    findMany: PrismaClient["role"]["findMany"];
  };
};

/** Read-only inspection: resolves the tenant, the canonical role (if any), and every duplicate. */
export async function inspect(
  prisma: PrismaLike,
  params: { tenantKey: string; roleName?: string },
): Promise<InspectResult> {
  const roleName = params.roleName ?? DEFAULT_ROLE_NAME;
  const canonicalKey = getTenantClubAdminRoleKey(params.tenantKey);

  const tenant = await prisma.tenant.findUnique({
    where: { key: params.tenantKey },
    select: { id: true, key: true, name: true },
  });

  if (!tenant) {
    return { tenant: { exists: false }, roleName, canonicalKey, canonical: null, duplicates: [] };
  }

  const [canonicalRow, duplicateRows] = await Promise.all([
    prisma.role.findFirst({
      where: { key: canonicalKey, scope: "TENANT", tenantId: tenant.id },
      select: SUMMARY_SELECT,
    }),
    prisma.role.findMany({
      where: {
        scope: "TENANT",
        tenantId: tenant.id,
        isArchived: false,
        key: { not: canonicalKey },
        name: { equals: roleName, mode: "insensitive" },
      },
      select: SUMMARY_SELECT,
    }),
  ]);

  return {
    tenant: { exists: true, id: tenant.id, key: tenant.key, name: tenant.name },
    roleName,
    canonicalKey,
    canonical: canonicalRow ? toCandidate(canonicalRow as CandidateRow) : null,
    duplicates: (duplicateRows as CandidateRow[]).map(toCandidate),
  };
}

// ---------------------------------------------------------------------------
// Dry-run plan — pure function built from an InspectResult, zero I/O
// ---------------------------------------------------------------------------

export function buildPlan(inspection: InspectResult): ConsolidationPlan {
  if (!inspection.tenant.exists) {
    return {
      tenantKey: "",
      roleName: inspection.roleName,
      canonicalKey: inspection.canonicalKey,
      tenantFound: false,
      canonicalRoleExists: false,
      willCreateCanonicalRole: false,
      legacyRoleKeys: [],
      legacyRoleIds: [],
      permissionKeysToMerge: [],
      userIdsToMove: [],
      noOpReason: "TENANT_NOT_FOUND",
      conflicts: ["Tenant not found — nothing to consolidate."],
    };
  }

  const conflicts: string[] = [];

  // Defense in depth: every candidate must belong to the resolved tenant.
  // inspect()'s query already guarantees this — this is a second, explicit
  // check so a future refactor of inspect() cannot silently regress into a
  // cross-tenant merge without this plan catching it first.
  for (const dup of inspection.duplicates) {
    if (dup.tenantId !== inspection.tenant.id) {
      conflicts.push(
        `Refusing cross-tenant consolidation: role "${dup.key}" belongs to tenant ${dup.tenantId ?? "null"}, not ${inspection.tenant.id}.`,
      );
    }
  }
  if (inspection.canonical && inspection.canonical.tenantId !== inspection.tenant.id) {
    conflicts.push(
      `Refusing consolidation: canonical role "${inspection.canonical.key}" belongs to tenant ${inspection.canonical.tenantId ?? "null"}, not ${inspection.tenant.id}.`,
    );
  }

  const canonicalPermissionKeys = new Set(inspection.canonical?.permissionKeys ?? []);
  const canonicalUserIds = new Set(inspection.canonical?.userIds ?? []);

  const permissionKeysToMerge = new Set<string>();
  const userIdsToMove = new Set<string>();
  for (const dup of inspection.duplicates) {
    for (const key of dup.permissionKeys) {
      if (!canonicalPermissionKeys.has(key)) permissionKeysToMerge.add(key);
    }
    for (const userId of dup.userIds) {
      if (!canonicalUserIds.has(userId)) userIdsToMove.add(userId);
    }
  }

  const noOpReason: NoOpReason = inspection.duplicates.length === 0 ? "NO_DUPLICATES_FOUND" : null;

  return {
    tenantKey: inspection.tenant.key ?? "",
    roleName: inspection.roleName,
    canonicalKey: inspection.canonicalKey,
    tenantFound: true,
    canonicalRoleExists: inspection.canonical !== null,
    willCreateCanonicalRole: inspection.canonical === null && inspection.duplicates.length > 0,
    legacyRoleKeys: inspection.duplicates.map((d) => d.key),
    legacyRoleIds: inspection.duplicates.map((d) => d.id),
    permissionKeysToMerge: Array.from(permissionKeysToMerge),
    userIdsToMove: Array.from(userIdsToMove),
    noOpReason,
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// Execute — transactional merge (or a pure read-only dry-run projection)
// ---------------------------------------------------------------------------

export async function runConsolidation(
  prisma: PrismaClient,
  params: { tenantKey: string; roleName?: string; dryRun: boolean },
): Promise<ConsolidationResult> {
  const roleName = params.roleName ?? DEFAULT_ROLE_NAME;
  const canonicalKey = getTenantClubAdminRoleKey(params.tenantKey);

  const inspection = await inspect(prisma, { tenantKey: params.tenantKey, roleName });
  const plan = buildPlan(inspection);

  const before: ConsolidationCounts = {
    canonicalPermissionCount: inspection.canonical?.permissionKeys.length ?? 0,
    canonicalUserCount: inspection.canonical?.userIds.length ?? 0,
    duplicateCount: inspection.duplicates.length,
  };

  if (params.dryRun) {
    return {
      tenantKey: params.tenantKey,
      tenantId: inspection.tenant.id ?? null,
      roleName,
      canonicalKey,
      canonicalRoleId: inspection.canonical?.id ?? null,
      canonicalRoleCreated: false,
      legacyRoleIds: plan.legacyRoleIds,
      legacyRolesArchived: [],
      permissionsMergedCount: plan.permissionKeysToMerge.length,
      userAssignmentsMovedCount: plan.userIdsToMove.length,
      dryRun: true,
      completed: false,
      noOp: plan.noOpReason !== null,
      before,
      after: before,
      postconditions: [],
    };
  }

  if (!inspection.tenant.exists) {
    throw new Error(`Tenant not found: ${params.tenantKey}`);
  }
  if (plan.conflicts.length > 0) {
    throw new Error(`Refusing to consolidate — conflicts detected:\n${plan.conflicts.join("\n")}`);
  }

  const tenantId = inspection.tenant.id!;

  const outcome = {
    canonicalRoleId: inspection.canonical?.id ?? null,
    canonicalRoleCreated: false,
    legacyRolesArchived: [] as string[],
    permissionsMergedCount: 0,
    userAssignmentsMovedCount: 0,
    postconditions: [] as Array<{ check: string; passed: boolean; detail: string }>,
  };

  if (plan.noOpReason !== null) {
    // Nothing to merge — still self-heal the canonical role's protection
    // invariants if it already exists but drifted (isSystem/isArchived).
    if (inspection.canonical && (!inspection.canonical.isSystem || inspection.canonical.isArchived)) {
      const healed = await prisma.role.update({
        where: { id: inspection.canonical.id },
        data: { isSystem: true, isArchived: false },
        select: { id: true },
      });
      outcome.canonicalRoleId = healed.id;
    }
  } else {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { key: params.tenantKey }, select: { id: true } });
      if (!tenant) throw new Error(`Tenant not found: ${params.tenantKey}`);
      if (tenant.id !== tenantId) throw new Error("Tenant id changed mid-transaction — aborting.");

      let canonical = outcome.canonicalRoleId
        ? await tx.role.findUnique({ where: { id: outcome.canonicalRoleId } })
        : null;

      if (!canonical) {
        canonical = await tx.role.create({
          data: {
            key: canonicalKey,
            name: roleName,
            description: "Full operational access within this club",
            scope: RoleScope.TENANT,
            tenantId,
            isSystem: true,
            isTemplate: false,
            isArchived: false,
          },
        });
        outcome.canonicalRoleCreated = true;
      } else {
        if (canonical.scope !== RoleScope.TENANT || canonical.tenantId !== tenantId) {
          throw new Error(
            `Refusing to consolidate: canonical role "${canonical.key}" is not a TENANT role of tenant ${tenantId}.`,
          );
        }
        if (!canonical.isSystem || canonical.isArchived) {
          canonical = await tx.role.update({
            where: { id: canonical.id },
            data: { isSystem: true, isArchived: false },
          });
        }
      }
      outcome.canonicalRoleId = canonical.id;

      const duplicates = await tx.role.findMany({
        where: { id: { in: plan.legacyRoleIds } },
        select: {
          id: true,
          key: true,
          tenantId: true,
          rolePermissions: { select: { id: true, permissionId: true } },
          userRoles: { select: { id: true, userId: true } },
        },
      });

      for (const dup of duplicates) {
        if (dup.tenantId !== tenantId) {
          throw new Error(
            `Refusing cross-tenant consolidation: role "${dup.key}" belongs to tenant ${dup.tenantId ?? "null"}, not ${tenantId}.`,
          );
        }

        for (const rp of dup.rolePermissions) {
          const existing = await tx.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: canonical.id, permissionId: rp.permissionId } },
            select: { id: true },
          });
          if (!existing) {
            await tx.rolePermission.create({
              data: { roleId: canonical.id, permissionId: rp.permissionId },
            });
            outcome.permissionsMergedCount++;
          }
        }

        for (const ur of dup.userRoles) {
          const existing = await tx.userRole.findUnique({
            where: { userId_roleId: { userId: ur.userId, roleId: canonical.id } },
            select: { id: true },
          });
          if (!existing) {
            await tx.userRole.create({
              data: { userId: ur.userId, roleId: canonical.id, tenantId },
            });
            outcome.userAssignmentsMovedCount++;
          }
          // Always remove the legacy assignment — its permissions/access are
          // now fully represented by the canonical UserRole row above.
          await tx.userRole.delete({ where: { id: ur.id } });
        }

        // The duplicate's RolePermission rows are now redundant (everything
        // unique has been copied to the canonical role) — clear them so the
        // archived role is an empty, auditable shell rather than a second
        // live permission set.
        await tx.rolePermission.deleteMany({ where: { roleId: dup.id } });
        await tx.role.update({ where: { id: dup.id }, data: { isArchived: true } });
        outcome.legacyRolesArchived.push(dup.key);
      }

      // ── Postconditions (checked inside the transaction — any failure
      // rolls back every write above) ──────────────────────────────────────
      const canonicalAfter = await tx.role.findUnique({
        where: { id: canonical.id },
        select: SUMMARY_SELECT,
      });
      const expectedUserIds = new Set<string>([
        ...(inspection.canonical?.userIds ?? []),
        ...inspection.duplicates.flatMap((d) => d.userIds),
      ]);
      const expectedPermissionKeys = new Set<string>([
        ...(inspection.canonical?.permissionKeys ?? []),
        ...inspection.duplicates.flatMap((d) => d.permissionKeys),
      ]);
      const canonicalUserIdsAfter = new Set((canonicalAfter?.userRoles ?? []).map((ur) => ur.userId));
      const canonicalPermissionKeysAfter = new Set(
        (canonicalAfter?.rolePermissions ?? []).map((rp) => rp.permission.key),
      );

      outcome.postconditions.push({
        check: "Canonical role is TENANT/isSystem=true/isArchived=false",
        passed:
          canonicalAfter?.scope === RoleScope.TENANT &&
          canonicalAfter?.isSystem === true &&
          canonicalAfter?.isArchived === false,
        detail: `scope=${canonicalAfter?.scope} isSystem=${canonicalAfter?.isSystem} isArchived=${canonicalAfter?.isArchived}`,
      });

      outcome.postconditions.push({
        check: "Canonical role belongs to the resolved tenant",
        passed: canonicalAfter?.tenantId === tenantId,
        detail: `tenantId=${canonicalAfter?.tenantId ?? "null"} (expected=${tenantId})`,
      });

      const missingUsers = Array.from(expectedUserIds).filter((id) => !canonicalUserIdsAfter.has(id));
      outcome.postconditions.push({
        check: "No admin access lost — every previously-assigned user is now on the canonical role",
        passed: missingUsers.length === 0,
        detail: missingUsers.length === 0 ? "all preserved" : `missing=${missingUsers.join(", ")}`,
      });

      const missingPermissions = Array.from(expectedPermissionKeys).filter(
        (key) => !canonicalPermissionKeysAfter.has(key),
      );
      outcome.postconditions.push({
        check: "All unique permissions preserved on the canonical role",
        passed: missingPermissions.length === 0,
        detail: missingPermissions.length === 0 ? "all preserved" : `missing=${missingPermissions.join(", ")}`,
      });

      const duplicatesAfter = await tx.role.findMany({
        where: { id: { in: plan.legacyRoleIds } },
        select: {
          id: true,
          isArchived: true,
          _count: { select: { rolePermissions: true, userRoles: true } },
        },
      });
      const duplicatesClean = duplicatesAfter.every(
        (d) => d.isArchived === true && d._count.rolePermissions === 0 && d._count.userRoles === 0,
      );
      outcome.postconditions.push({
        check: "Every duplicate role is archived with no remaining permissions or user assignments",
        passed: duplicatesClean,
        detail: duplicatesAfter
          .map((d) => `${d.id}: isArchived=${d.isArchived} perms=${d._count.rolePermissions} users=${d._count.userRoles}`)
          .join("; "),
      });

      // No duplicate UserRole rows: (userId, roleId) is a DB-level unique
      // constraint, so this is structurally guaranteed — asserted here for
      // audit-trail completeness, not as a real risk.
      const canonicalUserRoleCount = await tx.userRole.count({ where: { roleId: canonical.id } });
      outcome.postconditions.push({
        check: "No duplicate UserRole rows on the canonical role",
        passed: canonicalUserRoleCount === canonicalUserIdsAfter.size,
        detail: `rows=${canonicalUserRoleCount} distinctUsers=${canonicalUserIdsAfter.size}`,
      });

      const failed = outcome.postconditions.filter((pc) => !pc.passed);
      if (failed.length > 0) {
        const details = failed.map((pc) => `  FAILED: ${pc.check} (${pc.detail})`).join("\n");
        throw new Error(`Postcondition failure — rolling back consolidation transaction:\n${details}`);
      }
    });
  }

  const afterInspection = await inspect(prisma, { tenantKey: params.tenantKey, roleName });
  const after: ConsolidationCounts = {
    canonicalPermissionCount: afterInspection.canonical?.permissionKeys.length ?? 0,
    canonicalUserCount: afterInspection.canonical?.userIds.length ?? 0,
    duplicateCount: afterInspection.duplicates.length,
  };

  return {
    tenantKey: params.tenantKey,
    tenantId,
    roleName,
    canonicalKey,
    canonicalRoleId: outcome.canonicalRoleId,
    canonicalRoleCreated: outcome.canonicalRoleCreated,
    legacyRoleIds: plan.legacyRoleIds,
    legacyRolesArchived: outcome.legacyRolesArchived,
    permissionsMergedCount: outcome.permissionsMergedCount,
    userAssignmentsMovedCount: outcome.userAssignmentsMovedCount,
    dryRun: false,
    completed: true,
    noOp: plan.noOpReason !== null,
    before,
    after,
    postconditions: outcome.postconditions,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  inspect: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
  tenantKey: string;
  roleName: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    inspect: has("--inspect"),
    dryRun: has("--dry-run"),
    execute: has("--execute"),
    confirm: get("--confirm"),
    tenantKey: get("--tenant-key") ?? "fc-allschwil",
    roleName: get("--role-name") ?? DEFAULT_ROLE_NAME,
  };
}

function printInspect(result: InspectResult): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RPERM-05-C1 — Consolidate Club Admin Roles — Inspect Mode");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!result.tenant.exists) {
    console.log(`  Tenant not found — nothing to inspect.`);
    return;
  }

  console.log(`  Tenant             : ${result.tenant.name} (key=${result.tenant.key}, id=${result.tenant.id})`);
  console.log(`  Canonical role key  : ${result.canonicalKey}`);
  console.log(`  Canonical role found: ${result.canonical !== null}`);
  if (result.canonical) {
    console.log(`    id          : ${result.canonical.id}`);
    console.log(`    isSystem    : ${result.canonical.isSystem}`);
    console.log(`    permissions : ${result.canonical.permissionKeys.length}`);
    console.log(`    users       : ${result.canonical.userIds.length}`);
  }
  console.log(`\n  Duplicate roles found: ${result.duplicates.length}`);
  for (const dup of result.duplicates) {
    console.log(`    - ${dup.key} (id=${dup.id}, isSystem=${dup.isSystem}, permissions=${dup.permissionKeys.length}, users=${dup.userIds.length})`);
  }
  console.log("");
}

function printPlan(plan: ConsolidationPlan): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RPERM-05-C1 — Consolidate Club Admin Roles — Dry-Run Mode (zero DB writes)");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!plan.tenantFound) {
    console.log("  Tenant not found — no-op.");
    return;
  }

  console.log(`  Canonical role key         : ${plan.canonicalKey}`);
  console.log(`  Canonical role exists       : ${plan.canonicalRoleExists}`);
  console.log(`  Will create canonical role  : ${plan.willCreateCanonicalRole}`);
  console.log(`  Legacy/duplicate roles      : ${plan.legacyRoleKeys.join(", ") || "none"}`);
  console.log(`  Permissions to merge        : ${plan.permissionKeysToMerge.length}`);
  console.log(`  User assignments to move    : ${plan.userIdsToMove.length}`);
  console.log(`  No-op                       : ${plan.noOpReason ?? "false"}`);

  if (plan.conflicts.length > 0) {
    console.log("\n⚠  CONFLICTS DETECTED — --execute will be BLOCKED:");
    for (const c of plan.conflicts) console.log(`  ⚠  ${c}`);
  } else {
    console.log("\n  No conflicts detected.");
  }
  console.log("");
}

function printResult(result: ConsolidationResult): void {
  console.log("\n── AUDIT SUMMARY ─────────────────────────────────────────");
  console.log(`  Tenant                       : ${result.tenantKey} (id=${result.tenantId ?? "n/a"})`);
  console.log(`  Canonical role id            : ${result.canonicalRoleId ?? "n/a"}`);
  console.log(`  Canonical role created       : ${result.canonicalRoleCreated}`);
  console.log(`  Legacy role id(s)            : ${result.legacyRoleIds.join(", ") || "none"}`);
  console.log(`  Legacy role(s) archived      : ${result.legacyRolesArchived.join(", ") || "none"}`);
  console.log(`  Permissions merged           : ${result.permissionsMergedCount}`);
  console.log(`  User assignments moved       : ${result.userAssignmentsMovedCount}`);
  console.log(`  Dry-run                      : ${result.dryRun}`);
  console.log(`  Completed                    : ${result.completed}`);
  console.log(`  No-op                        : ${result.noOp}`);
  console.log(`  Before: canonical perms=${result.before.canonicalPermissionCount} users=${result.before.canonicalUserCount} duplicates=${result.before.duplicateCount}`);
  console.log(`  After : canonical perms=${result.after.canonicalPermissionCount} users=${result.after.canonicalUserCount} duplicates=${result.after.duplicateCount}`);

  if (result.postconditions.length > 0) {
    console.log("\n── POSTCONDITIONS ───────────────────────────────────────");
    for (const pc of result.postconditions) {
      const symbol = pc.passed ? "✓" : "✗";
      console.log(`  [${pc.passed ? "PASS" : "FAIL"}] ${symbol} ${pc.check} (${pc.detail})`);
    }
  }
  console.log("");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.inspect && !opts.dryRun && !opts.execute) {
    console.error("[rperm-05c1] ERROR: No mode specified. Use --inspect, --dry-run, or --execute.");
    process.exit(1);
  }

  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(
      `[rperm-05c1] REFUSED: --execute requires:\n` +
        `  --confirm ${EXECUTE_CONFIRMATION}\n\n` +
        `Exact confirmation value not provided or incorrect.`,
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[rperm-05c1] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error(
      "[rperm-05c1] BLOCKED: DATABASE_URL appears to point to a PRODUCTION database.\n" +
        "This script must only run against STAGE or LOCAL environments.",
    );
    process.exit(1);
  }

  console.log(`[rperm-05c1] Database: ${maskUrl(connectionString)}`);
  console.log(`[rperm-05c1] Detected environment: ${env}`);
  console.log(`[rperm-05c1] Tenant key: ${opts.tenantKey}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    if (opts.inspect) {
      const result = await inspect(prisma, { tenantKey: opts.tenantKey, roleName: opts.roleName });
      printInspect(result);
    }

    if (opts.dryRun) {
      const result = await runConsolidation(prisma, {
        tenantKey: opts.tenantKey,
        roleName: opts.roleName,
        dryRun: true,
      });
      const inspection = await inspect(prisma, { tenantKey: opts.tenantKey, roleName: opts.roleName });
      printPlan(buildPlan(inspection));
      printResult(result);
    }

    if (opts.execute) {
      console.log("\n[rperm-05c1] Executing consolidation within a transaction...\n");
      const result = await runConsolidation(prisma, {
        tenantKey: opts.tenantKey,
        roleName: opts.roleName,
        dryRun: false,
      });
      printResult(result);
      console.log("[rperm-05c1] Consolidation complete. Transaction committed successfully.");
    }
  } catch (error) {
    console.error("[rperm-05c1] FAILED:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main when invoked directly (not when imported by tests)
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((err) => {
    console.error("[rperm-05c1] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
