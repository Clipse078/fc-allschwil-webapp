/**
 * lib/permissions/teams-delete-permission-reconciliation.ts
 *
 * ADMIN-DELETE-01A-C1 — idempotent teams.delete backfill.
 *
 * Extracted reconciliation logic for scripts/sync-teams-delete-permission.ts,
 * mirroring the existing lib/permissions/training-permission-reconciliation.ts
 * pattern (STAGE-OPS-01/03/03A/03B) — this is the smallest already-established
 * idempotent permission-backfill mechanism in this repository, reused rather
 * than reinvented.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy (see
 * package.json's `build` script and scripts/sync-training-permissions.ts's own
 * doc comment for the identical, previously-diagnosed gap with
 * trainings.view/trainings.manage). Any STAGE/production database that was
 * seeded BEFORE the ADMIN-DELETE-01A commit added `teams.delete` to
 * prisma/seed.ts is missing:
 *   - the `teams.delete` Permission row entirely, and
 *   - its RolePermission assignment to `super_admin` and to every tenant's
 *     already-materialized Club Admin role.
 * Re-running prisma/seed.ts in full is possible (it is idempotent — all
 * writes are upserts) but is not how this repository normally patches a
 * single newly-added permission onto an already-seeded database; the
 * established, minimal pattern is a small, independently testable,
 * dry-run-by-default reconciliation script (see sync-workspace-permissions.ts,
 * sync-training-permissions.ts).
 *
 * ── What this reconciles ─────────────────────────────────────────────────────
 *   - Permission row: teams.delete (module=TEAMS, scope=TENANT,
 *     grantableByAdmin=true) — matches prisma/seed.ts exactly.
 *   - RolePermission: super_admin (PLATFORM role) → teams.delete. Mirrors the
 *     existing, already-accepted seed policy that super_admin owns every
 *     permission key (prisma/seed.ts: `permissionKeys: permissions.map(...)`).
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (Role rows with scope=TENANT, isSystem=true, key matching the
 *     `club_admin__<tenantKey>` convention from
 *     lib/roles/tenant-role-keys.ts) → teams.delete. Mirrors the existing,
 *     already-accepted seed policy that a tenant's Club Admin role owns every
 *     TENANT-scoped permission (prisma/seed.ts's `tenantPermissionKeys`
 *     materialization step).
 *
 * Deliberately does NOT touch any other role — delegated/custom tenant roles
 * only receive teams.delete through the existing Roles & Permissions
 * delegation UI (grantableByAdmin: true), never automatically here.
 *
 * ── ADMIN-DELETE-01B-C1 — FC Allschwil legacy Club Admin compatibility ─────
 * ADMIN-DELETE-01B found (read-only, on STAGE) that the actually-assigned FC
 * Allschwil Club Admin role is `Role.key = "club_admin_fc_allschwil"`
 * (single-underscore, `isSystem: false`) — the second, divergent identity
 * documented in docs/RPERM_05_DISCOVERY.md §7 / docs/RPERM_05_C1_CORRECTIONS.md
 * Finding 1, produced by the (now-fixed) role-key duplication between
 * prisma/seed.ts and scripts/rperm-03b-bootstrap-admin-separation.ts. Step 3
 * above only ever matches the canonical `club_admin__<tenantKey>` prefix, so
 * it legitimately finds zero rows on any database where this specific legacy
 * row is the one actually in use — it@fcallschwil.ch's Club Admin never
 * received teams.delete.
 *
 * Step 4 below adds exactly one, narrowly-targeted compatibility rule for
 * this single already-known role identity — it does NOT generalize to any
 * other legacy-keyed or custom role. A role only qualifies when ALL of the
 * following independently-verified, trusted attributes hold simultaneously:
 *   - `Role.key` is the exact literal `club_admin_fc_allschwil` (no prefix or
 *     pattern match — a coincidentally-similar custom role key never
 *     matches).
 *   - `Role.scope === "TENANT"` (known Club Admin role semantics — a
 *     PLATFORM role can never qualify).
 *   - `Role.tenantId` equals the real `Tenant.id` looked up by the
 *     already-known FC Allschwil tenant key (`fc-allschwil`) — trusted
 *     tenant identity, resolved fresh from the database on every run, never
 *     assumed or hardcoded as an id literal.
 * Any role failing even one of these checks (wrong scope, wrong/missing
 * tenant, or simply a different key) is left completely untouched — this is
 * NOT a general legacy-role-normalization mechanism, does not rename or
 * archive anything, and does not touch the user's assignment. This is a
 * disposable compatibility shim: it becomes a permanent no-op the moment
 * `scripts/rperm-05c1-consolidate-club-admin-roles.ts` is ever run against
 * this environment (the legacy row is archived, never deleted, by that
 * script) — this reconciliation is safe to keep running indefinitely either
 * way.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 *
 * After applying, affected users must log out and log back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in time — see lib/auth/session-context.ts), though the authoritative
 * resolver-backed checks (requireApiPermission, hasTenantDeletionAuthority)
 * take effect immediately regardless of session cache staleness.
 */

import type { PermissionModule, PermissionScope, PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

// ── Constants ──────────────────────────────────────────────────────────────────

// Use the string literal rather than the generated PermissionScope/
// PermissionModule enum members, mirroring
// lib/permissions/training-permission-reconciliation.ts's TRAINING_MODULE
// convention — this keeps the reconciliation robust even if it ever runs
// against a Prisma client generated before this key's migration/module value
// existed.
const TEAMS_MODULE = "TEAMS" as PermissionModule;
const TENANT_SCOPE = "TENANT" as PermissionScope;

export const TEAMS_DELETE_PERMISSION_DEF = {
  key: "teams.delete",
  name: "Permanently delete teams",
  module: TEAMS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
} as const;

/** Automatic bootstrap recipient: the PLATFORM super_admin role. */
export const TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";

/** Prefix identifying an already-materialized per-tenant Club Admin role (lib/roles/tenant-role-keys.ts). */
export const TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

/**
 * ADMIN-DELETE-01B-C1 — the single, already-known FC Allschwil tenant key
 * (matches `TENANT_KEY` in scripts/rperm-03b-bootstrap-admin-separation.ts).
 * Used only to resolve the trusted tenant identity for the narrow legacy
 * compatibility check below — never to construct or guess a role key.
 */
export const FC_ALLSCHWIL_TENANT_KEY = "fc-allschwil";

/**
 * ADMIN-DELETE-01B-C1 — the single, already-known, actually-assigned legacy
 * FC Allschwil Club Admin `Role.key` (single-underscore — distinct from the
 * canonical `club_admin__fc-allschwil`). This is an EXACT literal, not a
 * pattern: it identifies exactly one specific pre-existing role row and
 * never matches any other role, canonical or custom.
 */
export const FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY = "club_admin_fc_allschwil";

// ── Result types ───────────────────────────────────────────────────────────────

export type PermissionSyncOutcome =
  | { action: "created"; key: string }
  | { action: "already_exists"; key: string }
  | { action: "updated"; key: string };

export type RolePermissionSyncOutcome =
  | { action: "assigned"; roleKey: string; permissionKey: string }
  | { action: "already_assigned"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string }
  | { action: "permission_not_in_db"; roleKey: string; permissionKey: string };

export type TeamsDeleteReconciliationResult = {
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
  /**
   * ADMIN-DELETE-01B-C1 — outcome of the narrow FC Allschwil legacy Club
   * Admin compatibility check (see module doc comment, "Step 4"). `null`
   * means the trusted-attribute check did not recognize any role in this
   * database as the legacy FC Allschwil Club Admin (e.g. the FC Allschwil
   * tenant does not exist here, the legacy role key is absent, or an
   * existing role at that key does not match the required scope/tenant) —
   * nothing was touched in that case.
   */
  fcAllschwilLegacyClubAdmin: RolePermissionSyncOutcome | null;
};

// ── Reconciliation ─────────────────────────────────────────────────────────────

/**
 * Reconciles the `teams.delete` permission and its bootstrap role grants.
 *
 * Idempotent: safe to call multiple times without side effects. Does NOT
 * commit any changes when `dryRun` is true.
 *
 * Step 1: Ensure the `teams.delete` Permission row exists.
 * Step 2: Grant it to `super_admin` (PLATFORM).
 * Step 3: Grant it to every already-materialized per-tenant Club Admin role.
 */
export async function reconcileTeamsDeletePermission(
  prisma: PrismaClient,
  dryRun = false,
): Promise<TeamsDeleteReconciliationResult> {
  const def = TEAMS_DELETE_PERMISSION_DEF;

  // ── Step 1: Ensure the Permission row exists ────────────────────────────────
  const existingPermission = await prisma.permission.findUnique({
    where: { key: def.key },
    select: { id: true, name: true, module: true, scope: true, grantableByAdmin: true },
  });

  let permissionOutcome: PermissionSyncOutcome;
  if (existingPermission) {
    const needsUpdate =
      existingPermission.name !== def.name ||
      existingPermission.module !== def.module ||
      existingPermission.scope !== def.scope ||
      existingPermission.grantableByAdmin !== def.grantableByAdmin;
    permissionOutcome = { action: needsUpdate ? "updated" : "already_exists", key: def.key };
  } else {
    permissionOutcome = { action: "created", key: def.key };
  }

  if (!dryRun) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { name: def.name, module: def.module, scope: def.scope, grantableByAdmin: def.grantableByAdmin },
      create: { key: def.key, name: def.name, module: def.module, scope: def.scope, grantableByAdmin: def.grantableByAdmin },
    });
  }

  // ── Step 2: Grant to super_admin (PLATFORM) ─────────────────────────────────
  const superAdminOutcome = await assignPermissionToRole(
    prisma,
    TEAMS_DELETE_SUPER_ADMIN_ROLE_KEY,
    def.key,
    dryRun,
  );

  // ── Step 3: Grant to every already-materialized tenant Club Admin role ─────
  const tenantClubAdminRoles = await prisma.role.findMany({
    where: {
      scope: "TENANT",
      isSystem: true,
      key: { startsWith: TENANT_CLUB_ADMIN_ROLE_KEY_PREFIX },
    },
    select: { key: true },
  });

  const tenantClubAdminOutcomes: RolePermissionSyncOutcome[] = [];
  for (const role of tenantClubAdminRoles) {
    tenantClubAdminOutcomes.push(
      await assignPermissionToRole(prisma, role.key, def.key, dryRun),
    );
  }

  // ── Step 4: Narrow FC Allschwil legacy Club Admin compatibility grant ──────
  const fcAllschwilLegacyRoleKey = await resolveFcAllschwilLegacyClubAdminRoleKey(prisma);
  const fcAllschwilLegacyClubAdminOutcome = fcAllschwilLegacyRoleKey
    ? await assignPermissionToRole(prisma, fcAllschwilLegacyRoleKey, def.key, dryRun)
    : null;

  return {
    permission: permissionOutcome,
    superAdmin: superAdminOutcome,
    tenantClubAdminRoles: tenantClubAdminOutcomes,
    fcAllschwilLegacyClubAdmin: fcAllschwilLegacyClubAdminOutcome,
  };
}

/**
 * ADMIN-DELETE-01B-C1 — resolves the legacy FC Allschwil Club Admin role key
 * ONLY when every trusted attribute independently matches (see module doc
 * comment, "Step 4"). Returns `null` (never touches anything) the moment any
 * single check fails — this function never widens its match beyond the one
 * already-known role identity.
 */
async function resolveFcAllschwilLegacyClubAdminRoleKey(
  prisma: PrismaClient,
): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { key: FC_ALLSCHWIL_TENANT_KEY },
    select: { id: true },
  });
  if (!tenant) return null;

  const role = await prisma.role.findUnique({
    where: { key: FC_ALLSCHWIL_LEGACY_CLUB_ADMIN_ROLE_KEY },
    select: { key: true, scope: true, tenantId: true },
  });
  if (!role) return null;
  if (role.scope !== "TENANT") return null;
  if (role.tenantId !== tenant.id) return null;

  return role.key;
}

async function assignPermissionToRole(
  prisma: PrismaClient,
  roleKey: string,
  permissionKey: string,
  dryRun: boolean,
): Promise<RolePermissionSyncOutcome> {
  const role = await prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });

  if (!role) {
    return { action: "role_not_found", roleKey, permissionKey };
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true },
  });

  if (!permission) {
    // Only reachable in dry-run mode — apply mode upserts the permission
    // row in Step 1 before this function is ever called.
    return { action: "permission_not_in_db", roleKey, permissionKey };
  }

  const existing = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    select: { roleId: true },
  });

  const outcome: RolePermissionSyncOutcome = existing
    ? { action: "already_assigned", roleKey, permissionKey }
    : { action: "assigned", roleKey, permissionKey };

  if (!dryRun) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  return outcome;
}
