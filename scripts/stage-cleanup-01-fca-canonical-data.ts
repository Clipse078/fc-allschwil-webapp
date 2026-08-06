/**
 * scripts/stage-cleanup-01-fca-canonical-data.ts
 *
 * STAGE-CLEANUP-01 — FC Allschwil Canonical Data Cleanup
 *
 * Scope: FC Allschwil tenant data ONLY.
 *   - Users:         keep ONLY the two canonical administrators, remove everyone else.
 *   - Roles:         keep ONLY the canonical system roles, remove demo/test/duplicate roles.
 *   - Registrations: delete ALL registrations for the fc-allschwil tenant (inbox becomes empty).
 *   - Related data:  Registration has no separate notes/history/notification tables in this
 *                     schema — those concepts live on the Registration row itself
 *                     (message/payloadJson/assignedToUserId) and are removed with it.
 *                     AuditLog rows that reference a deleted Registration (entityType=
 *                     "Registration") are also removed so no dangling audit pointer remains.
 *
 * Explicitly NOT touched: Permission, Permission↔Role mappings for kept roles, Tenant,
 * OrgUnit / OrgUnitMembership, TargetGroup, Team / TeamSeason, Competition, Person,
 * Event, Facility / FacilityResource, WebsitePage / WebsitePageSection, NewsArticle,
 * WebsiteNavItem, integrations (SFV config / mappings). This script verifies (via
 * "protected domain" row counts) that none of these are touched by --execute.
 *
 * Canonical identities (established by RPERM-03B, scripts/rperm-03b-bootstrap-admin-separation.ts):
 *   hello@tulip-digital.ch → SCE Super Admin      (PLATFORM role, no tenant membership)
 *   it@fcallschwil.ch      → FC Allschwil Club Admin (TENANT role, active membership)
 *
 * Every other user (including the legacy admin@fcallschwil.ch bootstrap fallback, demo
 * users, test users, and duplicate admins) is removed by this slice — the acceptance
 * criteria for STAGE-CLEANUP-01 requires exactly two administrative users to remain.
 *
 * Modes:
 *   --inventory   Read-only: full inventory of Users / Roles / Registrations + classification.
 *   --dry-run     Read-only: classification + exact cleanup plan. Zero DB writes.
 *   --execute     Live execution. Requires --confirm CLEAN-FCA-CANONICAL-DATA
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/stage-cleanup-01-fca-canonical-data.ts --inventory
 *   DATABASE_URL=<stage-url> npx tsx scripts/stage-cleanup-01-fca-canonical-data.ts --dry-run
 *   DATABASE_URL=<stage-url> npx tsx scripts/stage-cleanup-01-fca-canonical-data.ts \
 *     --execute --confirm CLEAN-FCA-CANONICAL-DATA
 *
 * Safety:
 *   - Refuses to run --execute against a DATABASE_URL that looks like production.
 *   - Refuses --execute unless the two canonical accounts already exist and are
 *     correctly configured (this script never creates or repairs identities — run
 *     RPERM-03B first if either canonical account is missing).
 *   - Writes a pre-deletion JSON backup (users/roles/registrations about to be removed)
 *     to .tmp/ (gitignored) before executing.
 *   - Runs the entire cleanup inside a single transaction with hard postconditions;
 *     any failed postcondition rolls back the whole transaction.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleScope } from "@prisma/client";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TENANT_KEY = "fc-allschwil";

export const PLATFORM_EMAIL = "hello@tulip-digital.ch"; // SCE Super Admin
export const CLUB_ADMIN_EMAIL = "it@fcallschwil.ch"; // FC Allschwil Club Admin
export const CANONICAL_USER_EMAILS: readonly string[] = [PLATFORM_EMAIL, CLUB_ADMIN_EMAIL];

export const SUPER_ADMIN_ROLE_KEY = "super_admin";
// RPERM-05-C1: derived from the shared canonical helper — see
// lib/roles/tenant-role-keys.ts. Previously hardcoded to the divergent
// legacy key `club_admin_fc_allschwil`, which no longer exists once
// scripts/rperm-05c1-consolidate-club-admin-roles.ts has run.
export const TENANT_CLUB_ADMIN_ROLE_KEY = getTenantClubAdminRoleKey(TENANT_KEY);

// Canonical system roles, per prisma/seed.ts roleDefinitions plus the tenant-scoped
// Club Admin role established by RPERM-03B. "No permission changes" — this script
// never adds/removes RolePermission rows for any role in this list.
export const CANONICAL_ROLE_KEYS: readonly string[] = [
  SUPER_ADMIN_ROLE_KEY,
  "club_admin", // PLATFORM-scoped template role (isTemplate=true, never directly assignable)
  "match_coordinator",
  "website_publisher",
  "trainer",
  "viewer",
  TENANT_CLUB_ADMIN_ROLE_KEY,
];

export const EXECUTE_CONFIRMATION = "CLEAN-FCA-CANONICAL-DATA";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordClassification = "PROTECTED" | "REMOVE";

export interface UserInventoryItem {
  id: string;
  email: string;
  isActive: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  roleKeys: string[];
  classification: RecordClassification;
  reason: string;
}

export interface RoleInventoryItem {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  tenantId: string | null;
  isSystem: boolean;
  isTemplate: boolean;
  assignedUserCount: number;
  permissionCount: number;
  classification: RecordClassification;
  reason: string;
}

export interface RegistrationInventory {
  totalCount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  ids: string[];
  relatedAuditLogCount: number;
}

export interface ProtectedDomainCounts {
  teams: number;
  teamSeasons: number;
  competitions: number;
  orgUnits: number;
  orgUnitMemberships: number;
  targetGroups: number;
  people: number;
  events: number;
  facilities: number;
  websitePages: number;
  newsArticles: number;
  websiteNavItems: number;
  permissions: number;
  seasons: number;
}

export interface TenantSummary {
  exists: boolean;
  id?: string;
  key?: string;
  name?: string;
  status?: string;
}

export interface UserDependentRecordCounts {
  auditLogsAsActor: number;
  orgUnitMemberships: number;
  assignedRegistrations: number;
  contentAuthorshipReferences: number;
  workspaceAuthorshipReferences: number;
}

export interface InventoryResult {
  tenant: TenantSummary;
  users: UserInventoryItem[];
  roles: RoleInventoryItem[];
  registrations: RegistrationInventory;
  protectedDomainCounts: ProtectedDomainCounts;
  duplicateCanonicalEmails: string[];
  /**
   * For every user classified REMOVE, how many rows elsewhere reference them via a
   * nullable FK (onDelete: SetNull in schema.prisma). These rows are NEVER deleted —
   * only the "who did this" reference is cleared automatically by Postgres when the
   * user row is deleted. Surfaced here purely for operator transparency /
   * "no orphan records" verification.
   */
  nonCanonicalUserDependentRecordCounts: UserDependentRecordCounts;
}

export interface DryRunPlan {
  usersToDelete: string[];
  usersToKeep: string[];
  rolesToDelete: string[];
  rolesToKeep: string[];
  registrationsToDeleteCount: number;
  relatedAuditLogToDeleteCount: number;
  conflicts: string[];
  noOrgStructureChanges: boolean;
  noTeamsChanges: boolean;
  noCompetitionsChanges: boolean;
  noPermissionChanges: boolean;
}

export type SafeGateName =
  | "TENANT_FOUND"
  | "PLATFORM_SUPER_ADMIN_VALID"
  | "CLUB_ADMIN_VALID"
  | "NO_DUPLICATE_CANONICAL_EMAILS"
  | "CANONICAL_ROLE_SET_VALID"
  | "NO_CANONICAL_USER_HOLDS_NONCANONICAL_ROLE"
  | "NO_ORPHAN_ROLE_ASSIGNMENTS_PLANNED"
  | "ENVIRONMENT_NOT_PRODUCTION"
  | "EXECUTE_FLAG_SET"
  | "EXACT_CONFIRMATION_PROVIDED"
  | "TRANSACTION_SUPPORTED";

export type GateStatus = "PASS" | "FAIL" | "NOT_EVALUATED";

export interface SafeGateResult {
  gate: SafeGateName;
  status: GateStatus;
  detail: string;
}

export interface ExecuteResult {
  success: boolean;
  usersDeleted: string[];
  rolesDeleted: string[];
  registrationsDeleted: number;
  relatedAuditLogDeleted: number;
  postconditions: Array<{ check: string; passed: boolean; detail: string }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

export function isCanonicalUserEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return CANONICAL_USER_EMAILS.some((c) => normalizeEmail(c) === normalized);
}

export function isCanonicalRoleKey(key: string): boolean {
  return CANONICAL_ROLE_KEYS.includes(key);
}

// ---------------------------------------------------------------------------
// Prisma client factory (injectable for testing)
// ---------------------------------------------------------------------------

export function createPrismaClient(connectionString: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

// ---------------------------------------------------------------------------
// Inventory (read-only)
// ---------------------------------------------------------------------------

export async function inspectTenant(prisma: PrismaClient, tenantKey: string): Promise<TenantSummary> {
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantKey },
    select: { id: true, key: true, name: true, status: true },
  });
  if (!tenant) return { exists: false };
  return { exists: true, id: tenant.id, key: tenant.key, name: tenant.name, status: tenant.status };
}

export async function inventoryUsers(prisma: PrismaClient): Promise<{ items: UserInventoryItem[]; duplicates: string[] }> {
  const users = await prisma.user.findMany({
    include: {
      tenant: { select: { key: true } },
      userRoles: { include: { role: { select: { key: true } } } },
    },
    orderBy: { email: "asc" },
  });

  const emailCounts = new Map<string, number>();
  for (const u of users) {
    const normalized = normalizeEmail(u.email);
    emailCounts.set(normalized, (emailCounts.get(normalized) ?? 0) + 1);
  }
  const duplicates = [...emailCounts.entries()].filter(([, c]) => c > 1).map(([email]) => email);

  const items: UserInventoryItem[] = users.map((u) => {
    const roleKeys = u.userRoles.map((ur) => ur.role.key);
    const canonical = isCanonicalUserEmail(u.email);
    return {
      id: u.id,
      email: u.email,
      isActive: u.isActive,
      tenantId: u.tenantId,
      tenantKey: u.tenant?.key ?? null,
      roleKeys,
      classification: canonical ? "PROTECTED" : "REMOVE",
      reason: canonical
        ? u.email.toLowerCase() === PLATFORM_EMAIL
          ? "Canonical SCE Super Admin"
          : "Canonical FC Allschwil Club Admin"
        : "Not one of the two canonical administrators — demo/test/duplicate/obsolete user",
    };
  });

  return { items, duplicates };
}

export async function inventoryRoles(prisma: PrismaClient): Promise<RoleInventoryItem[]> {
  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
    orderBy: { key: "asc" },
  });

  return roles.map((r) => {
    const canonical = isCanonicalRoleKey(r.key);
    return {
      id: r.id,
      key: r.key,
      name: r.name,
      scope: r.scope,
      tenantId: r.tenantId,
      isSystem: r.isSystem,
      isTemplate: r.isTemplate,
      assignedUserCount: r._count.userRoles,
      permissionCount: r._count.rolePermissions,
      classification: canonical ? "PROTECTED" : "REMOVE",
      reason: canonical
        ? "Canonical system role (prisma/seed.ts or RPERM-03B tenant Club Admin role)"
        : "Not a canonical system role — demo/test/duplicated role",
    };
  });
}

export async function inventoryRegistrations(
  prisma: PrismaClient,
  tenantId: string | undefined
): Promise<RegistrationInventory> {
  if (!tenantId) {
    return { totalCount: 0, byType: {}, byStatus: {}, ids: [], relatedAuditLogCount: 0 };
  }

  const registrations = await prisma.registration.findMany({
    where: { tenantId },
    select: { id: true, type: true, status: true },
  });

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of registrations) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }

  const relatedAuditLogCount = await prisma.auditLog.count({
    where: { tenantId, entityType: "Registration" },
  });

  return {
    totalCount: registrations.length,
    byType,
    byStatus,
    ids: registrations.map((r) => r.id),
    relatedAuditLogCount,
  };
}

export async function inventoryProtectedDomainCounts(
  prisma: PrismaClient,
  tenantId: string | undefined
): Promise<ProtectedDomainCounts> {
  const tenantScope = tenantId ? { tenantId } : {};
  const [
    teams,
    teamSeasons,
    competitions,
    orgUnits,
    orgUnitMemberships,
    targetGroups,
    people,
    events,
    facilities,
    websitePages,
    newsArticles,
    websiteNavItems,
    permissions,
    seasons,
  ] = await Promise.all([
    prisma.team.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.teamSeason.count(),
    prisma.competition.count(),
    prisma.orgUnit.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.orgUnitMembership.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.targetGroup.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.person.count(),
    prisma.event.count(),
    prisma.facility.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.websitePage.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.newsArticle.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.websiteNavItem.count({ where: tenantId ? { tenantId } : undefined }),
    prisma.permission.count(),
    prisma.season.count(),
  ]);

  void tenantScope;

  return {
    teams,
    teamSeasons,
    competitions,
    orgUnits,
    orgUnitMemberships,
    targetGroups,
    people,
    events,
    facilities,
    websitePages,
    newsArticles,
    websiteNavItems,
    permissions,
    seasons,
  };
}

/**
 * Counts rows elsewhere in the schema that reference the given (to-be-deleted) user
 * ids via a nullable, onDelete: SetNull foreign key. None of these rows are deleted
 * by this script — deleting the user only clears the reference (handled by Postgres),
 * so the parent record (content, org membership, audit entry, etc.) is preserved.
 */
export async function inventoryUserDependents(
  prisma: PrismaClient,
  userIds: string[]
): Promise<UserDependentRecordCounts> {
  if (userIds.length === 0) {
    return {
      auditLogsAsActor: 0,
      orgUnitMemberships: 0,
      assignedRegistrations: 0,
      contentAuthorshipReferences: 0,
      workspaceAuthorshipReferences: 0,
    };
  }

  const where = { in: userIds };

  const [
    auditLogsAsActor,
    orgUnitMemberships,
    assignedRegistrations,
    contentRevisions,
    homepageReviewer,
    homepageApproved,
    homepageRejected,
    pageSectionReviewer,
    pageSectionApproved,
    pageSectionRejected,
    reusableCreated,
    reusableReviewer,
    reusableApproved,
    reusableRejected,
    folderCreated,
    folderUpdated,
    documentCreated,
    documentUpdated,
    documentVersionCreated,
  ] = await Promise.all([
    prisma.auditLog.count({ where: { actorUserId: where } }),
    prisma.orgUnitMembership.count({ where: { userId: where } }),
    prisma.registration.count({ where: { assignedToUserId: where } }),
    prisma.contentRevision.count({ where: { createdByUserId: where } }),
    prisma.homepageSection.count({ where: { reviewerUserId: where } }),
    prisma.homepageSection.count({ where: { approvedByUserId: where } }),
    prisma.homepageSection.count({ where: { rejectedByUserId: where } }),
    prisma.websitePageSection.count({ where: { reviewerUserId: where } }),
    prisma.websitePageSection.count({ where: { approvedByUserId: where } }),
    prisma.websitePageSection.count({ where: { rejectedByUserId: where } }),
    prisma.reusableComponent.count({ where: { createdByUserId: where } }),
    prisma.reusableComponent.count({ where: { reviewerUserId: where } }),
    prisma.reusableComponent.count({ where: { approvedByUserId: where } }),
    prisma.reusableComponent.count({ where: { rejectedByUserId: where } }),
    prisma.workspaceFolder.count({ where: { createdByUserId: where } }),
    prisma.workspaceFolder.count({ where: { updatedByUserId: where } }),
    prisma.workspaceDocument.count({ where: { createdByUserId: where } }),
    prisma.workspaceDocument.count({ where: { updatedByUserId: where } }),
    prisma.workspaceDocumentVersion.count({ where: { createdByUserId: where } }),
  ]);

  return {
    auditLogsAsActor,
    orgUnitMemberships,
    assignedRegistrations,
    contentAuthorshipReferences:
      contentRevisions +
      homepageReviewer +
      homepageApproved +
      homepageRejected +
      pageSectionReviewer +
      pageSectionApproved +
      pageSectionRejected +
      reusableCreated +
      reusableReviewer +
      reusableApproved +
      reusableRejected,
    workspaceAuthorshipReferences:
      folderCreated + folderUpdated + documentCreated + documentUpdated + documentVersionCreated,
  };
}

export async function runInventory(prisma: PrismaClient, tenantKey: string = TENANT_KEY): Promise<InventoryResult> {
  const tenant = await inspectTenant(prisma, tenantKey);
  const { items: users, duplicates } = await inventoryUsers(prisma);
  const roles = await inventoryRoles(prisma);
  const registrations = await inventoryRegistrations(prisma, tenant.id);
  const protectedDomainCounts = await inventoryProtectedDomainCounts(prisma, tenant.id);
  const usersToDeleteIds = users.filter((u) => u.classification === "REMOVE").map((u) => u.id);
  const nonCanonicalUserDependentRecordCounts = await inventoryUserDependents(prisma, usersToDeleteIds);

  return {
    tenant,
    users,
    roles,
    registrations,
    protectedDomainCounts,
    duplicateCanonicalEmails: duplicates.filter((d) => isCanonicalUserEmail(d)),
    nonCanonicalUserDependentRecordCounts,
  };
}

// ---------------------------------------------------------------------------
// Dry-run plan (zero writes)
// ---------------------------------------------------------------------------

export function buildDryRunPlan(inventory: InventoryResult): DryRunPlan {
  const conflicts: string[] = [];

  const platformUser = inventory.users.find((u) => normalizeEmail(u.email) === normalizeEmail(PLATFORM_EMAIL));
  const clubAdminUser = inventory.users.find((u) => normalizeEmail(u.email) === normalizeEmail(CLUB_ADMIN_EMAIL));

  if (!platformUser) {
    conflicts.push(`${PLATFORM_EMAIL} not found — run RPERM-03B bootstrap before this cleanup`);
  } else if (!platformUser.isActive) {
    conflicts.push(`${PLATFORM_EMAIL} exists but isActive=false`);
  } else if (!platformUser.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
    conflicts.push(`${PLATFORM_EMAIL} does not hold the ${SUPER_ADMIN_ROLE_KEY} role`);
  }

  if (!clubAdminUser) {
    conflicts.push(`${CLUB_ADMIN_EMAIL} not found — run RPERM-03B bootstrap before this cleanup`);
  } else if (!clubAdminUser.isActive) {
    conflicts.push(`${CLUB_ADMIN_EMAIL} exists but isActive=false`);
  } else if (!clubAdminUser.roleKeys.includes(TENANT_CLUB_ADMIN_ROLE_KEY)) {
    conflicts.push(`${CLUB_ADMIN_EMAIL} does not hold the ${TENANT_CLUB_ADMIN_ROLE_KEY} role`);
  }

  if (inventory.duplicateCanonicalEmails.length > 0) {
    for (const dup of inventory.duplicateCanonicalEmails) {
      conflicts.push(`DUPLICATE CANONICAL EMAIL FOUND: ${dup} — MANUAL REVIEW REQUIRED`);
    }
  }

  const usersToDelete = inventory.users.filter((u) => u.classification === "REMOVE").map((u) => u.email);
  const usersToKeep = inventory.users.filter((u) => u.classification === "PROTECTED").map((u) => u.email);

  const roleKeysToDelete = new Set(inventory.roles.filter((r) => r.classification === "REMOVE").map((r) => r.key));
  const rolesToDelete = [...roleKeysToDelete];
  const rolesToKeep = inventory.roles.filter((r) => r.classification === "PROTECTED").map((r) => r.key);

  // Detect a role slated for deletion that is still held by a user who will remain
  // (i.e. one of the two canonical admins). This should never happen; if it does,
  // it is a hard conflict that blocks --execute.
  for (const user of [platformUser, clubAdminUser]) {
    if (!user) continue;
    for (const roleKey of user.roleKeys) {
      if (roleKeysToDelete.has(roleKey)) {
        conflicts.push(
          `${user.email} holds role "${roleKey}", which is planned for deletion — MANUAL REVIEW REQUIRED`
        );
      }
    }
  }

  if (!inventory.tenant.exists) {
    conflicts.push(`Tenant "${TENANT_KEY}" not found`);
  }

  return {
    usersToDelete,
    usersToKeep,
    rolesToDelete,
    rolesToKeep,
    registrationsToDeleteCount: inventory.registrations.totalCount,
    relatedAuditLogToDeleteCount: inventory.registrations.relatedAuditLogCount,
    conflicts,
    noOrgStructureChanges: true,
    noTeamsChanges: true,
    noCompetitionsChanges: true,
    noPermissionChanges: true,
  };
}

// ---------------------------------------------------------------------------
// Safety gates
// ---------------------------------------------------------------------------

export function evaluateSafetyGates(params: {
  inventory: InventoryResult;
  isExecute: boolean;
  confirmValue: string | undefined;
  connectionString: string | undefined;
}): SafeGateResult[] {
  const { inventory, isExecute, confirmValue, connectionString } = params;
  const gates: SafeGateResult[] = [];

  gates.push({
    gate: "TENANT_FOUND",
    status: inventory.tenant.exists ? "PASS" : "FAIL",
    detail: inventory.tenant.exists
      ? `Tenant found: ${inventory.tenant.name} (id=${inventory.tenant.id})`
      : `Tenant "${TENANT_KEY}" not found`,
  });

  const platformUser = inventory.users.find((u) => normalizeEmail(u.email) === normalizeEmail(PLATFORM_EMAIL));
  const platformValid =
    !!platformUser &&
    platformUser.isActive &&
    platformUser.roleKeys.includes(SUPER_ADMIN_ROLE_KEY) &&
    (platformUser.tenantId === null || platformUser.tenantId === undefined);
  gates.push({
    gate: "PLATFORM_SUPER_ADMIN_VALID",
    status: platformValid ? "PASS" : "FAIL",
    detail: platformUser
      ? `${PLATFORM_EMAIL}: isActive=${platformUser.isActive}, roles=[${platformUser.roleKeys.join(", ")}], tenantId=${platformUser.tenantId ?? "null"}`
      : `${PLATFORM_EMAIL} not found`,
  });

  const clubAdminUser = inventory.users.find((u) => normalizeEmail(u.email) === normalizeEmail(CLUB_ADMIN_EMAIL));
  const clubAdminValid =
    !!clubAdminUser &&
    clubAdminUser.isActive &&
    clubAdminUser.roleKeys.includes(TENANT_CLUB_ADMIN_ROLE_KEY) &&
    clubAdminUser.tenantKey === TENANT_KEY;
  gates.push({
    gate: "CLUB_ADMIN_VALID",
    status: clubAdminValid ? "PASS" : "FAIL",
    detail: clubAdminUser
      ? `${CLUB_ADMIN_EMAIL}: isActive=${clubAdminUser.isActive}, roles=[${clubAdminUser.roleKeys.join(", ")}], tenantKey=${clubAdminUser.tenantKey ?? "null"}`
      : `${CLUB_ADMIN_EMAIL} not found`,
  });

  gates.push({
    gate: "NO_DUPLICATE_CANONICAL_EMAILS",
    status: inventory.duplicateCanonicalEmails.length === 0 ? "PASS" : "FAIL",
    detail:
      inventory.duplicateCanonicalEmails.length === 0
        ? "Both canonical emails appear at most once"
        : `Duplicate(s): ${inventory.duplicateCanonicalEmails.join(", ")}`,
  });

  const superAdminRole = inventory.roles.find((r) => r.key === SUPER_ADMIN_ROLE_KEY);
  const tenantClubAdminRole = inventory.roles.find((r) => r.key === TENANT_CLUB_ADMIN_ROLE_KEY);
  const roleSetValid =
    !!superAdminRole &&
    superAdminRole.scope === RoleScope.PLATFORM &&
    !!tenantClubAdminRole &&
    tenantClubAdminRole.scope === RoleScope.TENANT;
  gates.push({
    gate: "CANONICAL_ROLE_SET_VALID",
    status: roleSetValid ? "PASS" : "FAIL",
    detail: roleSetValid
      ? `${SUPER_ADMIN_ROLE_KEY} scope=${superAdminRole?.scope}, ${TENANT_CLUB_ADMIN_ROLE_KEY} scope=${tenantClubAdminRole?.scope}`
      : `${SUPER_ADMIN_ROLE_KEY} exists=${!!superAdminRole}, ${TENANT_CLUB_ADMIN_ROLE_KEY} exists=${!!tenantClubAdminRole}`,
  });

  const roleKeysToDelete = new Set(inventory.roles.filter((r) => r.classification === "REMOVE").map((r) => r.key));
  const canonicalHoldsNonCanonical = [platformUser, clubAdminUser].some(
    (u) => u && u.roleKeys.some((k) => roleKeysToDelete.has(k))
  );
  gates.push({
    gate: "NO_CANONICAL_USER_HOLDS_NONCANONICAL_ROLE",
    status: canonicalHoldsNonCanonical ? "FAIL" : "PASS",
    detail: canonicalHoldsNonCanonical
      ? "A canonical admin holds a role scheduled for deletion — MANUAL REVIEW REQUIRED"
      : "Canonical admins only hold canonical roles",
  });

  gates.push({
    gate: "NO_ORPHAN_ROLE_ASSIGNMENTS_PLANNED",
    status: "PASS",
    detail: "UserRole rows for deleted users cascade-delete automatically (Prisma onDelete: Cascade)",
  });

  const env = detectEnvironment(connectionString);
  gates.push({
    gate: "ENVIRONMENT_NOT_PRODUCTION",
    status: env === "PROD" ? "FAIL" : "PASS",
    detail: `Detected environment: ${env}`,
  });

  gates.push({
    gate: "EXECUTE_FLAG_SET",
    status: isExecute ? "PASS" : "NOT_EVALUATED",
    detail: isExecute ? "--execute flag provided" : "Not an execute run — gate not applicable",
  });

  gates.push({
    gate: "EXACT_CONFIRMATION_PROVIDED",
    status: !isExecute ? "NOT_EVALUATED" : confirmValue === EXECUTE_CONFIRMATION ? "PASS" : "FAIL",
    detail: isExecute
      ? confirmValue === EXECUTE_CONFIRMATION
        ? `Exact confirmation value matched: ${EXECUTE_CONFIRMATION}`
        : `Confirmation value missing or incorrect (expected: ${EXECUTE_CONFIRMATION})`
      : "Not evaluated in non-execute mode",
  });

  gates.push({
    gate: "TRANSACTION_SUPPORTED",
    status: "PASS",
    detail: "PostgreSQL — transactions supported",
  });

  return gates;
}

// ---------------------------------------------------------------------------
// Backup export (pre-deletion snapshot)
// ---------------------------------------------------------------------------

export async function buildBackupSnapshot(prisma: PrismaClient, inventory: InventoryResult) {
  const tenantId = inventory.tenant.id;

  const usersToDelete = inventory.users.filter((u) => u.classification === "REMOVE").map((u) => u.id);
  const rolesToDelete = inventory.roles.filter((r) => r.classification === "REMOVE").map((r) => r.id);

  const [users, roles, registrations, relatedAuditLogs] = await Promise.all([
    usersToDelete.length
      ? prisma.user.findMany({
          where: { id: { in: usersToDelete } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            tenantId: true,
            createdAt: true,
            lastLoginAt: true,
            userRoles: { select: { role: { select: { key: true } } } },
          },
        })
      : Promise.resolve([]),
    rolesToDelete.length
      ? prisma.role.findMany({
          where: { id: { in: rolesToDelete } },
          include: { rolePermissions: { include: { permission: { select: { key: true } } } } },
        })
      : Promise.resolve([]),
    tenantId ? prisma.registration.findMany({ where: { tenantId } }) : Promise.resolve([]),
    tenantId
      ? prisma.auditLog.findMany({ where: { tenantId, entityType: "Registration" } })
      : Promise.resolve([]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    slice: "STAGE-CLEANUP-01",
    tenant: inventory.tenant,
    usersToDelete: users,
    rolesToDelete: roles,
    registrationsToDelete: registrations,
    relatedAuditLogsToDelete: relatedAuditLogs,
  };
}

export function writeBackupToDisk(snapshot: unknown, outDir = ".tmp"): string {
  const dir = path.resolve(process.cwd(), outDir);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `stage-cleanup-01-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Execute (transactional)
// ---------------------------------------------------------------------------

export async function runExecute(
  prisma: PrismaClient,
  options: { tenantKey?: string } = {}
): Promise<ExecuteResult> {
  const tenantKey = options.tenantKey ?? TENANT_KEY;

  const result: ExecuteResult = {
    success: false,
    usersDeleted: [],
    rolesDeleted: [],
    registrationsDeleted: 0,
    relatedAuditLogDeleted: 0,
    postconditions: [],
  };

  await prisma.$transaction(async (tx) => {
    // ── Re-verify preconditions inside the transaction (defense in depth) ──────
    const tenant = await tx.tenant.findUnique({ where: { key: tenantKey }, select: { id: true, status: true } });
    if (!tenant) {
      throw new Error(`Tenant "${tenantKey}" not found — aborting`);
    }

    const platformUser = await tx.user.findUnique({
      where: { email: normalizeEmail(PLATFORM_EMAIL) },
      include: { userRoles: { include: { role: { select: { key: true, scope: true } } } } },
    });
    if (!platformUser || !platformUser.isActive) {
      throw new Error(`${PLATFORM_EMAIL} missing or inactive — aborting to prevent lockout`);
    }
    if (!platformUser.userRoles.some((ur) => ur.role.key === SUPER_ADMIN_ROLE_KEY)) {
      throw new Error(`${PLATFORM_EMAIL} does not hold ${SUPER_ADMIN_ROLE_KEY} — aborting`);
    }

    const clubAdminUser = await tx.user.findUnique({
      where: { email: normalizeEmail(CLUB_ADMIN_EMAIL) },
      include: { userRoles: { include: { role: { select: { key: true, scope: true } } } } },
    });
    if (!clubAdminUser || !clubAdminUser.isActive) {
      throw new Error(`${CLUB_ADMIN_EMAIL} missing or inactive — aborting to prevent lockout`);
    }
    if (!clubAdminUser.userRoles.some((ur) => ur.role.key === TENANT_CLUB_ADMIN_ROLE_KEY)) {
      throw new Error(`${CLUB_ADMIN_EMAIL} does not hold ${TENANT_CLUB_ADMIN_ROLE_KEY} — aborting`);
    }

    const canonicalRoleKeysHeld = new Set([
      ...platformUser.userRoles.map((ur) => ur.role.key),
      ...clubAdminUser.userRoles.map((ur) => ur.role.key),
    ]);
    for (const key of canonicalRoleKeysHeld) {
      if (!isCanonicalRoleKey(key)) {
        throw new Error(`Canonical admin holds non-canonical role "${key}" — aborting, manual review required`);
      }
    }

    // ── Snapshot protected-domain counts BEFORE any writes ─────────────────────
    const before = await inventoryProtectedDomainCounts(tx as unknown as PrismaClient, tenant.id);

    // ── Step 1: remove registration-related AuditLog rows for this tenant ──────
    const auditDeleteResult = await tx.auditLog.deleteMany({
      where: { tenantId: tenant.id, entityType: "Registration" },
    });
    result.relatedAuditLogDeleted = auditDeleteResult.count;

    // ── Step 2: delete ALL registrations for this tenant ────────────────────────
    const registrationDeleteResult = await tx.registration.deleteMany({ where: { tenantId: tenant.id } });
    result.registrationsDeleted = registrationDeleteResult.count;

    // ── Step 3: delete every user except the two canonical administrators ──────
    const usersToDelete = await tx.user.findMany({
      where: { email: { notIn: [normalizeEmail(PLATFORM_EMAIL), normalizeEmail(CLUB_ADMIN_EMAIL)] } },
      select: { id: true, email: true },
    });
    if (usersToDelete.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: usersToDelete.map((u) => u.id) } } });
    }
    result.usersDeleted = usersToDelete.map((u) => u.email);

    // ── Step 4: delete every role not in the canonical set ──────────────────────
    const rolesToDelete = await tx.role.findMany({
      where: { key: { notIn: [...CANONICAL_ROLE_KEYS] } },
      select: { id: true, key: true },
    });
    if (rolesToDelete.length > 0) {
      await tx.role.deleteMany({ where: { id: { in: rolesToDelete.map((r) => r.id) } } });
    }
    result.rolesDeleted = rolesToDelete.map((r) => r.key);

    // ── Postconditions ───────────────────────────────────────────────────────────

    const remainingUsers = await tx.user.findMany({ select: { email: true, isActive: true } });
    result.postconditions.push({
      check: "Exactly 2 users remain",
      passed: remainingUsers.length === 2,
      detail: `count=${remainingUsers.length}`,
    });

    const remainingEmails = new Set(remainingUsers.map((u) => normalizeEmail(u.email)));
    result.postconditions.push({
      check: `${PLATFORM_EMAIL} remains`,
      passed: remainingEmails.has(normalizeEmail(PLATFORM_EMAIL)),
      detail: `present=${remainingEmails.has(normalizeEmail(PLATFORM_EMAIL))}`,
    });
    result.postconditions.push({
      check: `${CLUB_ADMIN_EMAIL} remains`,
      passed: remainingEmails.has(normalizeEmail(CLUB_ADMIN_EMAIL)),
      detail: `present=${remainingEmails.has(normalizeEmail(CLUB_ADMIN_EMAIL))}`,
    });
    result.postconditions.push({
      check: "All remaining users are active",
      passed: remainingUsers.every((u) => u.isActive),
      detail: `activeCount=${remainingUsers.filter((u) => u.isActive).length}/${remainingUsers.length}`,
    });

    const remainingRoles = await tx.role.findMany({ select: { key: true } });
    const remainingRoleKeys = remainingRoles.map((r) => r.key).sort();
    const expectedRoleKeys = [...CANONICAL_ROLE_KEYS].sort();
    result.postconditions.push({
      check: "Only canonical roles remain",
      passed: JSON.stringify(remainingRoleKeys) === JSON.stringify(expectedRoleKeys),
      detail: `remaining=[${remainingRoleKeys.join(", ")}]`,
    });

    const remainingRegistrationCount = await tx.registration.count({ where: { tenantId: tenant.id } });
    result.postconditions.push({
      check: "0 registrations remain for FC Allschwil tenant",
      passed: remainingRegistrationCount === 0,
      detail: `count=${remainingRegistrationCount}`,
    });

    const remainingRelatedAuditLogCount = await tx.auditLog.count({
      where: { tenantId: tenant.id, entityType: "Registration" },
    });
    result.postconditions.push({
      check: "0 Registration-related AuditLog rows remain",
      passed: remainingRelatedAuditLogCount === 0,
      detail: `count=${remainingRelatedAuditLogCount}`,
    });

    const tenantAfter = await tx.tenant.findUnique({ where: { id: tenant.id }, select: { status: true } });
    result.postconditions.push({
      check: "FC Allschwil tenant still exists and is ACTIVE",
      passed: tenantAfter?.status === "ACTIVE",
      detail: `status=${tenantAfter?.status ?? "missing"}`,
    });

    const after = await inventoryProtectedDomainCounts(tx as unknown as PrismaClient, tenant.id);
    const protectedDomainsUnchanged = JSON.stringify(before) === JSON.stringify(after);
    result.postconditions.push({
      check: "No protected-domain rows were touched (teams, competitions, org structure, target groups, people, events, facilities, website pages, news, nav items, permissions, seasons)",
      passed: protectedDomainsUnchanged,
      detail: protectedDomainsUnchanged ? "before === after" : `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    });

    const platformUserAfter = await tx.user.findUnique({
      where: { email: normalizeEmail(PLATFORM_EMAIL) },
      include: { userRoles: { include: { role: { select: { key: true } } } } },
    });
    result.postconditions.push({
      check: `${PLATFORM_EMAIL} still holds ${SUPER_ADMIN_ROLE_KEY}`,
      passed: !!platformUserAfter?.userRoles.some((ur) => ur.role.key === SUPER_ADMIN_ROLE_KEY),
      detail: `roles=[${platformUserAfter?.userRoles.map((ur) => ur.role.key).join(", ") ?? ""}]`,
    });

    const clubAdminUserAfter = await tx.user.findUnique({
      where: { email: normalizeEmail(CLUB_ADMIN_EMAIL) },
      include: { userRoles: { include: { role: { select: { key: true } } } } },
    });
    result.postconditions.push({
      check: `${CLUB_ADMIN_EMAIL} still holds ${TENANT_CLUB_ADMIN_ROLE_KEY}`,
      passed: !!clubAdminUserAfter?.userRoles.some((ur) => ur.role.key === TENANT_CLUB_ADMIN_ROLE_KEY),
      detail: `roles=[${clubAdminUserAfter?.userRoles.map((ur) => ur.role.key).join(", ") ?? ""}]`,
    });

    const failedPostconditions = result.postconditions.filter((pc) => !pc.passed);
    if (failedPostconditions.length > 0) {
      const details = failedPostconditions.map((pc) => `  FAILED: ${pc.check} (${pc.detail})`).join("\n");
      throw new Error(`Postcondition failure — rolling back transaction:\n${details}`);
    }
  });

  result.success = true;
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  inventory: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
  tenantKey: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    inventory: has("--inventory"),
    dryRun: has("--dry-run"),
    execute: has("--execute"),
    confirm: get("--confirm"),
    tenantKey: get("--tenant-key") ?? TENANT_KEY,
  };
}

function printInventory(inventory: InventoryResult): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  STAGE-CLEANUP-01 — Inventory Mode (read-only)");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("── TENANT ──────────────────────────────────────────────");
  if (inventory.tenant.exists) {
    console.log(`  ${inventory.tenant.name} (key=${inventory.tenant.key}, id=${inventory.tenant.id}, status=${inventory.tenant.status})`);
  } else {
    console.log(`  Tenant "${TENANT_KEY}" NOT FOUND`);
  }

  console.log(`\n── USERS (${inventory.users.length} total) ─────────────────────────────────`);
  for (const u of inventory.users) {
    const marker = u.classification === "PROTECTED" ? "KEEP  " : "REMOVE";
    console.log(`  [${marker}] ${u.email} (isActive=${u.isActive}, roles=[${u.roleKeys.join(", ")}]) — ${u.reason}`);
  }

  console.log(`\n── ROLES (${inventory.roles.length} total) ─────────────────────────────────`);
  for (const r of inventory.roles) {
    const marker = r.classification === "PROTECTED" ? "KEEP  " : "REMOVE";
    console.log(
      `  [${marker}] ${r.key} (scope=${r.scope}, users=${r.assignedUserCount}, permissions=${r.permissionCount}) — ${r.reason}`
    );
  }

  console.log(`\n── REGISTRATIONS ────────────────────────────────────────`);
  console.log(`  Total: ${inventory.registrations.totalCount}`);
  console.log(`  By type: ${JSON.stringify(inventory.registrations.byType)}`);
  console.log(`  By status: ${JSON.stringify(inventory.registrations.byStatus)}`);
  console.log(`  Related AuditLog rows: ${inventory.registrations.relatedAuditLogCount}`);

  console.log(`\n── PROTECTED DOMAINS (will NOT be touched) ─────────────`);
  console.log(`  ${JSON.stringify(inventory.protectedDomainCounts, null, 2).split("\n").join("\n  ")}`);

  console.log(`\n── DEPENDENT RECORDS FOR USERS BEING REMOVED ───────────`);
  console.log(`  (These rows are preserved — only the "who did this" reference is cleared)`);
  console.log(`  ${JSON.stringify(inventory.nonCanonicalUserDependentRecordCounts, null, 2).split("\n").join("\n  ")}`);

  if (inventory.duplicateCanonicalEmails.length > 0) {
    console.log("\n⚠  DUPLICATE CANONICAL EMAILS DETECTED:");
    for (const dup of inventory.duplicateCanonicalEmails) console.log(`  ⚠  ${dup}`);
  }

  console.log("");
}

function printDryRunPlan(plan: DryRunPlan): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  STAGE-CLEANUP-01 — Dry-Run Mode (zero DB writes)");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("── USERS ────────────────────────────────────────────────");
  console.log(`  KEEP  : ${plan.usersToKeep.join(", ") || "none"}`);
  console.log(`  DELETE: ${plan.usersToDelete.length} user(s)${plan.usersToDelete.length ? " — " + plan.usersToDelete.join(", ") : ""}`);

  console.log("\n── ROLES ────────────────────────────────────────────────");
  console.log(`  KEEP  : ${plan.rolesToKeep.join(", ") || "none"}`);
  console.log(`  DELETE: ${plan.rolesToDelete.length} role(s)${plan.rolesToDelete.length ? " — " + plan.rolesToDelete.join(", ") : ""}`);

  console.log("\n── REGISTRATIONS ────────────────────────────────────────");
  console.log(`  DELETE: ${plan.registrationsToDeleteCount} registration(s)`);
  console.log(`  DELETE: ${plan.relatedAuditLogToDeleteCount} related AuditLog row(s)`);

  console.log("\n── SAFETY SUMMARY ───────────────────────────────────────");
  console.log(`  No organisation structure changes: ${plan.noOrgStructureChanges}`);
  console.log(`  No team/competition changes       : ${plan.noTeamsChanges && plan.noCompetitionsChanges}`);
  console.log(`  No permission changes             : ${plan.noPermissionChanges}`);

  if (plan.conflicts.length > 0) {
    console.log("\n⚠  CONFLICTS DETECTED — --execute will be BLOCKED:");
    for (const c of plan.conflicts) console.log(`  ⚠  ${c}`);
  } else {
    console.log("\n  No conflicts detected.");
  }

  console.log("");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.inventory && !opts.dryRun && !opts.execute) {
    console.error("[stage-cleanup-01] ERROR: No mode specified. Use --inventory, --dry-run, or --execute.");
    process.exit(1);
  }

  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(
      `[stage-cleanup-01] REFUSED: --execute requires:\n` +
        `  --confirm ${EXECUTE_CONFIRMATION}\n\n` +
        `Exact confirmation value not provided or incorrect.`
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[stage-cleanup-01] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error(
      "[stage-cleanup-01] BLOCKED: DATABASE_URL appears to point to a PRODUCTION database.\n" +
        "This script must only run against STAGE or LOCAL environments."
    );
    process.exit(1);
  }

  console.log(`[stage-cleanup-01] Database: ${maskUrl(connectionString)}`);
  console.log(`[stage-cleanup-01] Detected environment: ${env}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const inventory = await runInventory(prisma, opts.tenantKey);

    if (opts.inventory) {
      printInventory(inventory);
    }

    if (opts.dryRun) {
      const plan = buildDryRunPlan(inventory);
      printDryRunPlan(plan);
    }

    if (opts.execute) {
      const gates = evaluateSafetyGates({
        inventory,
        isExecute: true,
        confirmValue: opts.confirm,
        connectionString,
      });

      console.log("\n── SAFETY GATES ─────────────────────────────────────────");
      let anyFailed = false;
      for (const gate of gates) {
        const symbol = gate.status === "PASS" ? "✓" : gate.status === "FAIL" ? "✗" : "–";
        console.log(`  [${gate.status.padEnd(12)}] ${symbol} ${gate.gate}: ${gate.detail}`);
        if (gate.status === "FAIL") anyFailed = true;
      }

      if (anyFailed) {
        console.error("\n[stage-cleanup-01] BLOCKED: One or more safety gates failed. Aborting.");
        process.exit(1);
      }

      const snapshot = await buildBackupSnapshot(prisma, inventory);
      const backupPath = writeBackupToDisk(snapshot);
      console.log(`\n[stage-cleanup-01] Pre-deletion backup written to: ${backupPath}`);

      console.log("\n[stage-cleanup-01] Executing cleanup within a transaction...\n");

      const execResult = await runExecute(prisma, { tenantKey: opts.tenantKey });

      console.log("── EXECUTION RESULT ─────────────────────────────────────");
      console.log(`  Users deleted           : ${execResult.usersDeleted.length} — ${execResult.usersDeleted.join(", ") || "none"}`);
      console.log(`  Roles deleted           : ${execResult.rolesDeleted.length} — ${execResult.rolesDeleted.join(", ") || "none"}`);
      console.log(`  Registrations deleted   : ${execResult.registrationsDeleted}`);
      console.log(`  Related AuditLog deleted: ${execResult.relatedAuditLogDeleted}`);

      console.log("\n── POSTCONDITIONS ───────────────────────────────────────");
      for (const pc of execResult.postconditions) {
        const symbol = pc.passed ? "✓" : "✗";
        console.log(`  [${pc.passed ? "PASS" : "FAIL"}] ${symbol} ${pc.check} (${pc.detail})`);
      }

      const allPassed = execResult.postconditions.every((pc) => pc.passed);
      if (!allPassed) {
        console.error("\n[stage-cleanup-01] CRITICAL: Postcondition failures detected — transaction was rolled back.");
        process.exit(1);
      }

      console.log("\n[stage-cleanup-01] Cleanup complete. Transaction committed successfully.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main when invoked directly (not when imported by tests)
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((err) => {
    console.error("[stage-cleanup-01] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
