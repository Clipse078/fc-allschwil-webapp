/**
 * lib/events/events-delete-permission-reconciliation.ts
 *
 * CLUB-EVENTS-01-C1 — idempotent events.delete permission backfill.
 *
 * Mirrors lib/permissions/planning-modules-delete-permission-reconciliation.ts
 * (ADMIN-DELETE-02A) — the established, already-accepted pattern for patching
 * a newly-added "<module>.delete" permission onto an already-seeded database.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * prisma/seed.ts is NOT automatically re-run after a deploy. Any STAGE/
 * production database that was seeded before CLUB-EVENTS-01-C1 added
 * `events.delete` to prisma/seed.ts is missing:
 *   - the Permission row entirely, and
 *   - its RolePermission assignment to `super_admin` and to every
 *     already-materialized tenant Club Admin role.
 *
 * ── What this reconciles ─────────────────────────────────────────────────────
 *   - Permission row (key, name, module, scope, grantableByAdmin —
 *     matches prisma/seed.ts exactly).
 *   - RolePermission: super_admin (PLATFORM role) → events.delete.
 *   - RolePermission: every already-materialized per-tenant Club Admin role
 *     (Role rows with scope=TENANT, isSystem=true, key starting with
 *     `club_admin__` — the RPERM-05-C1 canonical convention) → events.delete.
 *
 * Deliberately does NOT touch any other role. Custom/delegated tenant roles
 * receive events.delete only through the existing Roles & Permissions
 * delegation UI (grantableByAdmin: true), never automatically here.
 *
 * All writes use upsert — safe to re-run any number of times. No deletes.
 *
 * After applying, affected users must log out and back in for the new
 * permission to appear in their session JWT (permissions are embedded at
 * sign-in — lib/auth/session-context.ts). The authoritative resolver-backed
 * checks (requireApiPermission, hasTenantDeletionAuthority) take effect
 * immediately regardless of session-cache staleness.
 */

import type { PrismaClient } from "@prisma/client";
import { CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";

// ── Constants ─────────────────────────────────────────────────────────────────

// String literals rather than generated enum members — keeps this robust even
// if it runs against a Prisma client generated before these values existed.
const EVENTS_MODULE = "EVENTS" as Parameters<PrismaClient["permission"]["upsert"]>[0]["create"]["module"];
const TENANT_SCOPE = "TENANT" as Parameters<PrismaClient["permission"]["upsert"]>[0]["create"]["scope"];

export const EVENTS_DELETE_SUPER_ADMIN_ROLE_KEY = "super_admin";
export const EVENTS_DELETE_CLUB_ADMIN_KEY_PREFIX = `${CLUB_ADMIN_TEMPLATE_KEY}__`;

export const EVENTS_DELETE_PERMISSION_DEF = {
  key: "events.delete",
  name: "Permanently delete Veranstaltungen",
  module: EVENTS_MODULE,
  scope: TENANT_SCOPE,
  grantableByAdmin: true,
} as const;

// ── Result types ──────────────────────────────────────────────────────────────

export type PermissionSyncOutcome =
  | { action: "created"; key: string }
  | { action: "already_exists"; key: string }
  | { action: "updated"; key: string };

export type RolePermissionSyncOutcome =
  | { action: "assigned"; roleKey: string; permissionKey: string }
  | { action: "already_assigned"; roleKey: string; permissionKey: string }
  | { action: "role_not_found"; roleKey: string; permissionKey: string }
  | { action: "permission_not_in_db"; roleKey: string; permissionKey: string };

export type EventsDeletePermissionReconciliationResult = {
  permission: PermissionSyncOutcome;
  superAdmin: RolePermissionSyncOutcome;
  tenantClubAdminRoles: RolePermissionSyncOutcome[];
};

// ── Reconciliation ────────────────────────────────────────────────────────────

/**
 * Reconciles the events.delete permission and its bootstrap role grants.
 * Idempotent: safe to call multiple times without side effects.
 * Does NOT commit any changes when `dryRun` is true.
 */
export async function reconcileEventsDeletePermission(
  prisma: PrismaClient,
  dryRun = false,
): Promise<EventsDeletePermissionReconciliationResult> {
  const def = EVENTS_DELETE_PERMISSION_DEF;

  // ── Step 1: Ensure the Permission row exists ──────────────────────────────
  const existing = await prisma.permission.findUnique({
    where: { key: def.key },
    select: { id: true, name: true, module: true, scope: true, grantableByAdmin: true },
  });

  let permissionOutcome: PermissionSyncOutcome;
  if (existing) {
    const needsUpdate =
      existing.name !== def.name ||
      existing.module !== def.module ||
      existing.scope !== def.scope ||
      existing.grantableByAdmin !== def.grantableByAdmin;
    permissionOutcome = { action: needsUpdate ? "updated" : "already_exists", key: def.key };
  } else {
    permissionOutcome = { action: "created", key: def.key };
  }

  if (!dryRun) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: {
        name: def.name,
        module: def.module,
        scope: def.scope,
        grantableByAdmin: def.grantableByAdmin,
      },
      create: {
        key: def.key,
        name: def.name,
        module: def.module,
        scope: def.scope,
        grantableByAdmin: def.grantableByAdmin,
      },
    });
  }

  // ── Step 2: Grant to super_admin (PLATFORM) ───────────────────────────────
  const superAdminOutcome = await assignPermissionToRole(
    prisma,
    EVENTS_DELETE_SUPER_ADMIN_ROLE_KEY,
    def.key,
    dryRun,
  );

  // ── Step 3: Grant to every already-materialized tenant Club Admin role ────
  const clubAdminRoles = await prisma.role.findMany({
    where: {
      scope: "TENANT",
      isSystem: true,
      key: { startsWith: EVENTS_DELETE_CLUB_ADMIN_KEY_PREFIX },
    },
    select: { key: true },
  });

  const tenantClubAdminOutcomes: RolePermissionSyncOutcome[] = [];
  for (const role of clubAdminRoles) {
    tenantClubAdminOutcomes.push(
      await assignPermissionToRole(prisma, role.key, def.key, dryRun),
    );
  }

  return {
    permission: permissionOutcome,
    superAdmin: superAdminOutcome,
    tenantClubAdminRoles: tenantClubAdminOutcomes,
  };
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function assignPermissionToRole(
  prisma: PrismaClient,
  roleKey: string,
  permissionKey: string,
  dryRun: boolean,
): Promise<RolePermissionSyncOutcome> {
  const role = await prisma.role.findUnique({
    where: { key: roleKey },
    select: { id: true },
  });

  if (!role) {
    return { action: "role_not_found", roleKey, permissionKey };
  }

  const permission = await prisma.permission.findUnique({
    where: { key: permissionKey },
    select: { id: true },
  });

  if (!permission) {
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
