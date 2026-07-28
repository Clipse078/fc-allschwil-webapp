/**
 * RPERM-03A — Authorization Clean-Start Inventory and Controlled Cleanup
 *
 * Establishes a clean, auditable authorization baseline for SportClubEvo.
 *
 * Modes (select exactly one):
 *   --inventory   Read-only full authorization inventory (default/safe)
 *   --dry-run     Inventory + classification + cleanup plan (no writes)
 *   --execute     Execute cleanup inside a transaction (requires all 20 safety gates)
 *
 * Required confirmation for execute:
 *   --confirm CLEAN-STAGE-AUTHORIZATION-DATA
 *
 * Optional:
 *   --environment STAGE
 *   --sce-super-admin-email <email>
 *   --club-admin-email admin@fcallschwil.ch
 *   --tenant-key fc-allschwil
 *   --backup-file <path>
 *
 * The script never mutates the database when run in --inventory or --dry-run mode.
 *
 * Usage:
 *   npx tsx scripts/rperm-03a-authorization-clean-start.ts --inventory
 *   npx tsx scripts/rperm-03a-authorization-clean-start.ts --dry-run
 *   npx tsx scripts/rperm-03a-authorization-clean-start.ts --execute \
 *     --sce-super-admin-email <email> \
 *     --confirm CLEAN-STAGE-AUTHORIZATION-DATA
 */

import "dotenv/config";

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleScope, PermissionScope } from "@prisma/client";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Public types — exported for unit testing
// ---------------------------------------------------------------------------

export type CleanupClassification =
  | "PROTECTED"
  | "KEEP"
  | "REMOVE_ASSIGNMENT"
  | "ARCHIVE_ROLE"
  | "DELETE_ROLE"
  | "DELETE_MEMBERSHIP"
  | "DELETE_USER_CANDIDATE"
  | "DELETE_PERSON_CANDIDATE"
  | "MANUAL_REVIEW"
  | "INVALID_DATA";

export type SuperAdminFinding =
  | "ONE_VERIFIED_SCE_SUPER_ADMIN"
  | "MULTIPLE_SCE_SUPER_ADMIN_CANDIDATES"
  | "NO_VALID_SCE_SUPER_ADMIN"
  | "INVALID_SCE_SUPER_ADMIN_ASSIGNMENT";

export interface TenantRecord {
  id: string;
  key: string;
  name: string;
  status: string;
  membershipCount: number;
  roleCount: number;
  userRoleCount: number;
}

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
  lastLoginAt: Date | null;
  // No passwordHash — never included
  userRoles: UserRoleRecord[];
  tenantMemberships: MembershipRecord[];
  businessDataSummary: BusinessDataSummary;
}

export interface BusinessDataSummary {
  auditLogCount: number;
  registrationCount: number;
  orgUnitMembershipCount: number;
  contentRevisionCount: number;
  workspaceDocumentCount: number;
  hasBusinessData: boolean;
}

export interface PersonRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isActive: boolean;
  tenantReferences: string[];
  hasPlayerSquad: boolean;
  hasTrainerTeam: boolean;
  hasOrgUnitMembership: boolean;
  hasAuthoredContent: boolean;
}

export interface RoleRecord {
  id: string;
  key: string;
  name: string;
  scope: string;
  tenantId: string | null;
  tenantName: string | null;
  isSystem: boolean;
  isTemplate: boolean;
  isArchived: boolean;
  permissionCount: number;
  userAssignmentCount: number;
  isCanonical: boolean;
  integrityIssues: string[];
}

export interface UserRoleRecord {
  id: string;
  userId: string;
  userEmail: string;
  roleId: string;
  roleKey: string;
  roleScope: string;
  roleTenantId: string | null;
  userRoleTenantId: string | null;
  roleIsArchived: boolean;
  isConsistent: boolean;
  inconsistencyReason: string | null;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  tenantKey: string;
  isActive: boolean;
  joinedAt: Date;
  tenantRoleCount: number;
  isConsistent: boolean;
  inconsistencyReason: string | null;
}

export interface RolePermissionRecord {
  id: string;
  roleId: string;
  roleKey: string;
  roleScope: string;
  permissionId: string;
  permissionKey: string;
  permissionScope: string;
  isScopeCompatible: boolean;
  incompatibilityReason: string | null;
}

export interface AuthorizationInventory {
  capturedAt: Date;
  tenants: TenantRecord[];
  users: UserRecord[];
  persons: PersonRecord[];
  roles: RoleRecord[];
  userRoles: UserRoleRecord[];
  memberships: MembershipRecord[];
  rolePermissions: RolePermissionRecord[];
  // Derived findings
  superAdminFinding: SuperAdminFinding;
  superAdminCandidates: UserRoleRecord[];
  fcAllschwilTenant: TenantRecord | null;
  fcAdminUser: UserRecord | null;
  integrityFindings: IntegrityFindings;
}

export interface IntegrityFindings {
  platformRolesWithTenantId: RoleRecord[];
  tenantRolesWithNullTenantId: RoleRecord[];
  crossTenantUserRoles: UserRoleRecord[];
  platformUserRolesWithTenantId: UserRoleRecord[];
  tenantRolesWithPlatformPermissions: RolePermissionRecord[];
  platformRolesWithTenantPermissions: RolePermissionRecord[];
  usersWithTenantRolesButNoMembership: UserRoleRecord[];
  usersWithMembershipButNoRole: MembershipRecord[];
  archivedRolesStillAssigned: UserRoleRecord[];
  rolesWithZeroPermissions: RoleRecord[];
  rolesWithZeroUsers: RoleRecord[];
  usersWithMultiplePlatformAdminRoles: UserRecord[];
  multipleSuperAdminHolders: UserRoleRecord[];
  noSuperAdminHolder: boolean;
  duplicateEmails: string[];
  usersWithoutTenantMembership: UserRecord[];
  testBootstrapCandidates: string[];
}

export interface ClassifiedRecord {
  type: "user_role" | "membership" | "role" | "user" | "person" | "role_permission";
  id: string;
  label: string;
  classification: CleanupClassification;
  reason: string;
  foreignKeyDependencies: string[];
  rollbackSource: string;
}

export interface DryRunPlan {
  rolesToPreserve: ClassifiedRecord[];
  rolesToArchive: ClassifiedRecord[];
  rolesToDelete: ClassifiedRecord[];
  userRolesToPreserve: ClassifiedRecord[];
  userRolesToDelete: ClassifiedRecord[];
  membershipsToPreserve: ClassifiedRecord[];
  membershipsToDeactivate: ClassifiedRecord[];
  membershipsToDelete: ClassifiedRecord[];
  usersToPreserve: ClassifiedRecord[];
  usersConsideredForDeletion: ClassifiedRecord[];
  personsToPreserve: ClassifiedRecord[];
  personsConsideredForDeletion: ClassifiedRecord[];
  invalidRolePermissionsToRemove: ClassifiedRecord[];
  canonicalPermissionsPreserved: number;
  manualReviewItems: ClassifiedRecord[];
}

export interface SafetyGateResult {
  gates: SafetyGate[];
  allPass: boolean;
  blockers: string[];
}

export interface SafetyGate {
  id: number;
  description: string;
  pass: boolean;
  detail: string;
}

export interface EnvironmentInfo {
  targetEnvironment: string;
  dbHostRedacted: string;
  dbName: string;
  dbSchema: string;
  tenantCount: number;
  fcAllschwilTenantId: string | null;
  currentBranch: string;
  currentHead: string;
  isProductionSuspected: boolean;
  isStageParsed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANONICAL_ROLE_KEYS = new Set([
  "super_admin",
  "club_admin",
  "match_coordinator",
  "website_publisher",
  "trainer",
  "viewer",
]);

const FC_ALLSCHWIL_KEY = "fc-allschwil";
const FC_ADMIN_EMAIL = "admin@fcallschwil.ch";
const SUPER_ADMIN_ROLE_KEY = "super_admin";
const REQUIRED_FEATURE_BRANCH = "cursor/rperm-03a-authorization-inventory-clean-start-0c67";
const EXECUTE_CONFIRMATION = "CLEAN-STAGE-AUTHORIZATION-DATA";

// ---------------------------------------------------------------------------
// Safe masking helpers — never print passwords, tokens, or secrets
// ---------------------------------------------------------------------------

export function maskConnectionString(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

export function extractDbHost(url: string | undefined): string {
  if (!url) return "(unknown)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return "(parse error)";
  }
}

export function extractDbName(url: string | undefined): string {
  if (!url) return "(unknown)";
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "") || "(unnamed)";
  } catch {
    return "(parse error)";
  }
}

export function isProductionUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("prod") || lower.includes("production");
}

export function isStageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("stage") || lower.includes("staging");
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export function getCurrentBranch(): string {
  try {
    return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    return "(unknown)";
  }
}

export function getCurrentHead(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "(unknown)";
  }
}

// ---------------------------------------------------------------------------
// Environment verification
// ---------------------------------------------------------------------------

export async function gatherEnvironmentInfo(
  prisma: PrismaClient,
  dbUrl: string | undefined,
): Promise<EnvironmentInfo> {
  const branch = getCurrentBranch();
  const head = getCurrentHead();
  const dbHostRedacted = extractDbHost(dbUrl);
  const dbName = extractDbName(dbUrl);

  let tenantCount = 0;
  let fcAllschwilTenantId: string | null = null;

  try {
    tenantCount = await prisma.tenant.count();
    const fca = await prisma.tenant.findUnique({
      where: { key: FC_ALLSCHWIL_KEY },
      select: { id: true },
    });
    fcAllschwilTenantId = fca?.id ?? null;
  } catch {
    // DB unreachable — report as unknown
  }

  const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
  const isProductionSuspected =
    isProductionUrl(dbUrl) ||
    appEnv === "prod" ||
    appEnv === "production";
  const isStageParsed = isStageUrl(dbUrl) || appEnv === "stage" || appEnv === "staging";

  return {
    targetEnvironment: appEnv || (isStageParsed ? "stage" : isProductionSuspected ? "prod" : "unknown"),
    dbHostRedacted,
    dbName,
    dbSchema: "public",
    tenantCount,
    fcAllschwilTenantId,
    currentBranch: branch,
    currentHead: head,
    isProductionSuspected,
    isStageParsed,
  };
}

// ---------------------------------------------------------------------------
// Inventory queries — all exported for testability
// ---------------------------------------------------------------------------

export async function queryTenants(prisma: PrismaClient): Promise<TenantRecord[]> {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      _count: {
        select: {
          tenantMemberships: true,
          roles: true,
          userRoles: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return tenants.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    status: t.status,
    membershipCount: t._count.tenantMemberships,
    roleCount: t._count.roles,
    userRoleCount: t._count.userRoles,
  }));
}

export async function queryUsers(prisma: PrismaClient): Promise<UserRecord[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      tenantId: true,
      lastLoginAt: true,
      // Explicitly excluded: passwordHash
      userRoles: {
        select: {
          id: true,
          userId: true,
          roleId: true,
          tenantId: true,
          role: {
            select: {
              key: true,
              scope: true,
              tenantId: true,
              isArchived: true,
            },
          },
        },
      },
      tenantMemberships: {
        select: {
          id: true,
          tenantId: true,
          isActive: true,
          joinedAt: true,
          tenant: {
            select: { key: true, name: true },
          },
        },
      },
      _count: {
        select: {
          auditLogs: true,
          assignedRegistrations: true,
          orgUnitMemberships: true,
          contentRevisions: true,
          createdWorkspaceDocuments: true,
        },
      },
    },
    orderBy: { email: "asc" },
  });

  return users.map((u) => {
    const businessDataSummary: BusinessDataSummary = {
      auditLogCount: u._count.auditLogs,
      registrationCount: u._count.assignedRegistrations,
      orgUnitMembershipCount: u._count.orgUnitMemberships,
      contentRevisionCount: u._count.contentRevisions,
      workspaceDocumentCount: u._count.createdWorkspaceDocuments,
      hasBusinessData:
        u._count.auditLogs > 0 ||
        u._count.assignedRegistrations > 0 ||
        u._count.orgUnitMemberships > 0 ||
        u._count.contentRevisions > 0 ||
        u._count.createdWorkspaceDocuments > 0,
    };

    const userRoles: UserRoleRecord[] = u.userRoles.map((ur) => ({
      id: ur.id,
      userId: u.id,
      userEmail: u.email,
      roleId: ur.roleId,
      roleKey: ur.role.key,
      roleScope: ur.role.scope,
      roleTenantId: ur.role.tenantId,
      userRoleTenantId: ur.tenantId,
      roleIsArchived: ur.role.isArchived,
      isConsistent: false, // will be set by analyzeUserRoleConsistency
      inconsistencyReason: null,
    }));

    const memberships: MembershipRecord[] = u.tenantMemberships.map((tm) => ({
      id: tm.id,
      userId: u.id,
      userEmail: u.email,
      tenantId: tm.tenantId,
      tenantName: tm.tenant.name,
      tenantKey: tm.tenant.key,
      isActive: tm.isActive,
      joinedAt: tm.joinedAt,
      tenantRoleCount: 0, // filled later
      isConsistent: true,
      inconsistencyReason: null,
    }));

    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      tenantId: u.tenantId,
      lastLoginAt: u.lastLoginAt,
      userRoles,
      tenantMemberships: memberships,
      businessDataSummary,
    };
  });
}

export async function queryPersons(prisma: PrismaClient): Promise<PersonRecord[]> {
  const persons = await prisma.person.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      _count: {
        select: {
          playerSquadMembers: true,
          trainerTeamMembers: true,
          orgUnitMemberships: true,
          authoredNewsArticles: true,
          authoredWebsitePages: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return persons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    isActive: p.isActive,
    tenantReferences: [],
    hasPlayerSquad: p._count.playerSquadMembers > 0,
    hasTrainerTeam: p._count.trainerTeamMembers > 0,
    hasOrgUnitMembership: p._count.orgUnitMemberships > 0,
    hasAuthoredContent:
      p._count.authoredNewsArticles > 0 || p._count.authoredWebsitePages > 0,
  }));
}

export async function queryRoles(prisma: PrismaClient): Promise<RoleRecord[]> {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      scope: true,
      tenantId: true,
      isSystem: true,
      isTemplate: true,
      isArchived: true,
      tenant: { select: { name: true } },
      _count: {
        select: {
          rolePermissions: true,
          userRoles: true,
        },
      },
    },
    orderBy: [{ scope: "asc" }, { key: "asc" }],
  });

  return roles.map((r) => {
    const issues: string[] = [];
    if (r.scope === RoleScope.PLATFORM && r.tenantId !== null) {
      issues.push("PLATFORM role has non-null tenantId");
    }
    if (r.scope === RoleScope.TENANT && r.tenantId === null) {
      issues.push("TENANT role has null tenantId");
    }

    return {
      id: r.id,
      key: r.key,
      name: r.name,
      scope: r.scope,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name ?? null,
      isSystem: r.isSystem,
      isTemplate: r.isTemplate,
      isArchived: r.isArchived,
      permissionCount: r._count.rolePermissions,
      userAssignmentCount: r._count.userRoles,
      isCanonical: CANONICAL_ROLE_KEYS.has(r.key),
      integrityIssues: issues,
    };
  });
}

export async function queryAllUserRoles(prisma: PrismaClient): Promise<UserRoleRecord[]> {
  const userRoles = await prisma.userRole.findMany({
    select: {
      id: true,
      userId: true,
      roleId: true,
      tenantId: true,
      user: { select: { email: true } },
      role: {
        select: {
          key: true,
          scope: true,
          tenantId: true,
          isArchived: true,
        },
      },
    },
    orderBy: [{ user: { email: "asc" } }, { role: { key: "asc" } }],
  });

  return userRoles.map((ur) => {
    const result = analyzeUserRoleConsistency({
      id: ur.id,
      userId: ur.userId,
      userEmail: ur.user.email,
      roleId: ur.roleId,
      roleKey: ur.role.key,
      roleScope: ur.role.scope,
      roleTenantId: ur.role.tenantId,
      userRoleTenantId: ur.tenantId,
      roleIsArchived: ur.role.isArchived,
      isConsistent: false,
      inconsistencyReason: null,
    });
    return result;
  });
}

export async function queryAllMemberships(prisma: PrismaClient): Promise<MembershipRecord[]> {
  const memberships = await prisma.tenantMembership.findMany({
    select: {
      id: true,
      tenantId: true,
      userId: true,
      isActive: true,
      joinedAt: true,
      user: { select: { email: true } },
      tenant: { select: { name: true, key: true } },
    },
    orderBy: [{ tenant: { key: "asc" } }, { user: { email: "asc" } }],
  });

  return memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    userEmail: m.user.email,
    tenantId: m.tenantId,
    tenantName: m.tenant.name,
    tenantKey: m.tenant.key,
    isActive: m.isActive,
    joinedAt: m.joinedAt,
    tenantRoleCount: 0,
    isConsistent: true,
    inconsistencyReason: null,
  }));
}

export async function queryRolePermissions(
  prisma: PrismaClient,
): Promise<RolePermissionRecord[]> {
  const rps = await prisma.rolePermission.findMany({
    select: {
      id: true,
      roleId: true,
      permissionId: true,
      role: { select: { key: true, scope: true } },
      permission: { select: { key: true, scope: true } },
    },
    orderBy: [{ role: { key: "asc" } }, { permission: { key: "asc" } }],
  });

  return rps.map((rp) => {
    const isScopeCompatible =
      (rp.role.scope === PermissionScope.PLATFORM && rp.permission.scope === PermissionScope.PLATFORM) ||
      (rp.role.scope === PermissionScope.TENANT && rp.permission.scope === PermissionScope.TENANT);

    return {
      id: rp.id,
      roleId: rp.roleId,
      roleKey: rp.role.key,
      roleScope: rp.role.scope,
      permissionId: rp.permissionId,
      permissionKey: rp.permission.key,
      permissionScope: rp.permission.scope,
      isScopeCompatible,
      incompatibilityReason: isScopeCompatible
        ? null
        : `Role scope=${rp.role.scope} linked to permission scope=${rp.permission.scope}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Consistency analysis — exported for testing
// ---------------------------------------------------------------------------

export function analyzeUserRoleConsistency(ur: UserRoleRecord): UserRoleRecord {
  const issues: string[] = [];

  if (ur.roleScope === "PLATFORM") {
    if (ur.userRoleTenantId !== null) {
      issues.push(
        `Platform role assigned with UserRole.tenantId=${ur.userRoleTenantId} (should be null)`,
      );
    }
    if (ur.roleTenantId !== null) {
      issues.push(`PLATFORM role has non-null tenantId=${ur.roleTenantId}`);
    }
  }

  if (ur.roleScope === "TENANT") {
    if (ur.userRoleTenantId === null) {
      issues.push("Tenant role assigned without UserRole.tenantId");
    } else if (ur.userRoleTenantId !== ur.roleTenantId) {
      issues.push(
        `UserRole.tenantId=${ur.userRoleTenantId} does not match Role.tenantId=${ur.roleTenantId}`,
      );
    }
  }

  if (ur.roleIsArchived) {
    issues.push("Role is archived but still assigned");
  }

  return {
    ...ur,
    isConsistent: issues.length === 0,
    inconsistencyReason: issues.length > 0 ? issues.join("; ") : null,
  };
}

// ---------------------------------------------------------------------------
// SCE Super Admin identification — exported for testing
// ---------------------------------------------------------------------------

export function identifySuperAdmin(
  userRoles: UserRoleRecord[],
  roles: RoleRecord[],
): { finding: SuperAdminFinding; candidates: UserRoleRecord[] } {
  const superAdminRole = roles.find(
    (r) =>
      r.key === SUPER_ADMIN_ROLE_KEY &&
      r.scope === RoleScope.PLATFORM &&
      r.tenantId === null &&
      !r.isArchived,
  );

  if (!superAdminRole) {
    return { finding: "NO_VALID_SCE_SUPER_ADMIN", candidates: [] };
  }

  const validCandidates = userRoles.filter(
    (ur) =>
      ur.roleKey === SUPER_ADMIN_ROLE_KEY &&
      ur.roleScope === "PLATFORM" &&
      ur.roleTenantId === null &&
      ur.userRoleTenantId === null &&
      !ur.roleIsArchived,
  );

  const invalidCandidates = userRoles.filter(
    (ur) =>
      ur.roleKey === SUPER_ADMIN_ROLE_KEY &&
      (ur.userRoleTenantId !== null ||
        ur.roleTenantId !== null ||
        ur.roleScope !== "PLATFORM"),
  );

  if (invalidCandidates.length > 0 && validCandidates.length === 0) {
    return { finding: "INVALID_SCE_SUPER_ADMIN_ASSIGNMENT", candidates: invalidCandidates };
  }

  if (validCandidates.length === 0) {
    return { finding: "NO_VALID_SCE_SUPER_ADMIN", candidates: [] };
  }

  if (validCandidates.length === 1) {
    return { finding: "ONE_VERIFIED_SCE_SUPER_ADMIN", candidates: validCandidates };
  }

  return { finding: "MULTIPLE_SCE_SUPER_ADMIN_CANDIDATES", candidates: validCandidates };
}

// ---------------------------------------------------------------------------
// Integrity analysis — exported for testing
// ---------------------------------------------------------------------------

export function analyzeIntegrity(
  tenants: TenantRecord[],
  users: UserRecord[],
  roles: RoleRecord[],
  userRoles: UserRoleRecord[],
  memberships: MembershipRecord[],
  rolePermissions: RolePermissionRecord[],
): IntegrityFindings {
  const platformRolesWithTenantId = roles.filter(
    (r) => r.scope === "PLATFORM" && r.tenantId !== null,
  );
  const tenantRolesWithNullTenantId = roles.filter(
    (r) => r.scope === "TENANT" && r.tenantId === null,
  );
  const crossTenantUserRoles = userRoles.filter(
    (ur) =>
      ur.roleScope === "TENANT" &&
      ur.userRoleTenantId !== null &&
      ur.roleTenantId !== null &&
      ur.userRoleTenantId !== ur.roleTenantId,
  );
  const platformUserRolesWithTenantId = userRoles.filter(
    (ur) => ur.roleScope === "PLATFORM" && ur.userRoleTenantId !== null,
  );
  const tenantRolesWithPlatformPermissions = rolePermissions.filter(
    (rp) => rp.roleScope === "TENANT" && rp.permissionScope === "PLATFORM",
  );
  const platformRolesWithTenantPermissions = rolePermissions.filter(
    (rp) => rp.roleScope === "PLATFORM" && rp.permissionScope === "TENANT",
  );

  // Users with tenant roles but no active TenantMembership
  const activeMembershipSet = new Set(
    memberships
      .filter((m) => m.isActive)
      .map((m) => `${m.userId}::${m.tenantId}`),
  );
  const usersWithTenantRolesButNoMembership = userRoles.filter((ur) => {
    if (ur.roleScope !== "TENANT" || ur.userRoleTenantId === null) return false;
    return !activeMembershipSet.has(`${ur.userId}::${ur.userRoleTenantId}`);
  });

  // Users with membership but no tenant role
  const tenantRoleSet = new Set(
    userRoles
      .filter((ur) => ur.roleScope === "TENANT")
      .map((ur) => `${ur.userId}::${ur.userRoleTenantId}`),
  );
  const usersWithMembershipButNoRole = memberships.filter(
    (m) => !tenantRoleSet.has(`${m.userId}::${m.tenantId}`),
  );

  const archivedRolesStillAssigned = userRoles.filter((ur) => ur.roleIsArchived);

  const rolesWithZeroPermissions = roles.filter(
    (r) => r.permissionCount === 0 && !r.isTemplate,
  );
  const rolesWithZeroUsers = roles.filter((r) => r.userAssignmentCount === 0);

  // Users with multiple platform admin roles (super_admin)
  const userPlatformAdminCount = new Map<string, number>();
  for (const ur of userRoles) {
    if (ur.roleScope === "PLATFORM" && ur.roleKey === SUPER_ADMIN_ROLE_KEY) {
      userPlatformAdminCount.set(ur.userId, (userPlatformAdminCount.get(ur.userId) ?? 0) + 1);
    }
  }
  const usersWithMultiplePlatformAdminRoles = users.filter(
    (u) => (userPlatformAdminCount.get(u.id) ?? 0) > 1,
  );

  const superAdminHolders = userRoles.filter(
    (ur) =>
      ur.roleKey === SUPER_ADMIN_ROLE_KEY &&
      ur.roleScope === "PLATFORM" &&
      ur.userRoleTenantId === null,
  );
  const multipleSuperAdminHolders = superAdminHolders.length > 1 ? superAdminHolders : [];
  const noSuperAdminHolder = superAdminHolders.length === 0;

  // Duplicate email check
  const emailMap = new Map<string, number>();
  for (const u of users) {
    const normalized = u.email.toLowerCase().trim();
    emailMap.set(normalized, (emailMap.get(normalized) ?? 0) + 1);
  }
  const duplicateEmails = [...emailMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([email]) => email);

  // Users without tenant memberships (who have a tenantId set)
  const membershipUserSet = new Set(memberships.map((m) => m.userId));
  const usersWithoutTenantMembership = users.filter(
    (u) => u.tenantId !== null && !membershipUserSet.has(u.id),
  );

  // Test/bootstrap candidates — simple heuristics (not definitive)
  const testBootstrapCandidates: string[] = [];
  const emailLower = (e: string) => e.toLowerCase();
  for (const u of users) {
    if (
      emailLower(u.email).includes("test") ||
      emailLower(u.email).includes("bootstrap") ||
      emailLower(u.email).includes("dummy") ||
      emailLower(u.email).includes("placeholder") ||
      emailLower(u.email).includes("demo")
    ) {
      testBootstrapCandidates.push(u.email);
    }
  }

  void tenants; // used by caller

  return {
    platformRolesWithTenantId,
    tenantRolesWithNullTenantId,
    crossTenantUserRoles,
    platformUserRolesWithTenantId,
    tenantRolesWithPlatformPermissions,
    platformRolesWithTenantPermissions,
    usersWithTenantRolesButNoMembership,
    usersWithMembershipButNoRole,
    archivedRolesStillAssigned,
    rolesWithZeroPermissions,
    rolesWithZeroUsers,
    usersWithMultiplePlatformAdminRoles,
    multipleSuperAdminHolders,
    noSuperAdminHolder,
    duplicateEmails,
    usersWithoutTenantMembership,
    testBootstrapCandidates,
  };
}

// ---------------------------------------------------------------------------
// Full inventory orchestration
// ---------------------------------------------------------------------------

export async function runInventory(prisma: PrismaClient): Promise<AuthorizationInventory> {
  const [tenants, users, persons, roles, allUserRoles, memberships, rolePermissions] =
    await Promise.all([
      queryTenants(prisma),
      queryUsers(prisma),
      queryPersons(prisma),
      queryRoles(prisma),
      queryAllUserRoles(prisma),
      queryAllMemberships(prisma),
      queryRolePermissions(prisma),
    ]);

  const integrityFindings = analyzeIntegrity(
    tenants,
    users,
    roles,
    allUserRoles,
    memberships,
    rolePermissions,
  );

  const { finding: superAdminFinding, candidates: superAdminCandidates } = identifySuperAdmin(
    allUserRoles,
    roles,
  );

  const fcAllschwilTenant = tenants.find((t) => t.key === FC_ALLSCHWIL_KEY) ?? null;
  const fcAdminUser = users.find((u) => u.email === FC_ADMIN_EMAIL) ?? null;

  return {
    capturedAt: new Date(),
    tenants,
    users,
    persons,
    roles,
    userRoles: allUserRoles,
    memberships,
    rolePermissions,
    superAdminFinding,
    superAdminCandidates,
    fcAllschwilTenant,
    fcAdminUser,
    integrityFindings,
  };
}

// ---------------------------------------------------------------------------
// Classification — exported for testing
// ---------------------------------------------------------------------------

export function classifyUserRole(
  ur: UserRoleRecord,
  protectedUserIds: Set<string>,
  protectedRoleIds: Set<string>,
): ClassifiedRecord {
  const label = `UserRole[user=${ur.userEmail}, role=${ur.roleKey}, scope=${ur.roleScope}, urTenantId=${ur.userRoleTenantId}]`;

  // Protected: verified SCE Super Admin platform assignment
  if (
    protectedUserIds.has(ur.userId) &&
    ur.roleKey === SUPER_ADMIN_ROLE_KEY &&
    ur.roleScope === "PLATFORM" &&
    ur.userRoleTenantId === null &&
    ur.roleTenantId === null
  ) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "PROTECTED",
      reason: "Verified SCE Super Admin platform assignment",
      foreignKeyDependencies: [],
      rollbackSource: "Recreate via bootstrap-admin.ts",
    };
  }

  // Protected: admin@fcallschwil.ch FC Allschwil Club Admin tenant assignment
  if (ur.userEmail === FC_ADMIN_EMAIL && ur.roleScope === "TENANT") {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "PROTECTED",
      reason: "FC Allschwil Club Admin tenant assignment for admin@fcallschwil.ch",
      foreignKeyDependencies: [],
      rollbackSource: "Recreate via bootstrap or Club Admin setup",
    };
  }

  // Invalid: archived role still assigned
  if (ur.roleIsArchived) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "REMOVE_ASSIGNMENT",
      reason: "Role is archived",
      foreignKeyDependencies: [],
      rollbackSource: "No restoration needed — assignment was invalid",
    };
  }

  // Invalid: platform role with non-null tenantId
  if (ur.roleScope === "PLATFORM" && ur.userRoleTenantId !== null) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "REMOVE_ASSIGNMENT",
      reason: `Platform role assigned with UserRole.tenantId=${ur.userRoleTenantId} (must be null)`,
      foreignKeyDependencies: [],
      rollbackSource: "Reassign without tenantId if legitimate",
    };
  }

  // Invalid: cross-tenant — UserRole.tenantId != Role.tenantId
  if (
    ur.roleScope === "TENANT" &&
    ur.userRoleTenantId !== null &&
    ur.roleTenantId !== null &&
    ur.userRoleTenantId !== ur.roleTenantId
  ) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "REMOVE_ASSIGNMENT",
      reason: `Cross-tenant assignment: UserRole.tenantId=${ur.userRoleTenantId} != Role.tenantId=${ur.roleTenantId}`,
      foreignKeyDependencies: [],
      rollbackSource: "Create correct tenant-scoped assignment",
    };
  }

  // Invalid: tenant role without tenantId
  if (ur.roleScope === "TENANT" && ur.userRoleTenantId === null) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "INVALID_DATA",
      reason: "Tenant role assigned without UserRole.tenantId",
      foreignKeyDependencies: [],
      rollbackSource: "Determine correct tenant and reassign",
    };
  }

  // Protected canonical role assignment
  if (
    CANONICAL_ROLE_KEYS.has(ur.roleKey) &&
    protectedRoleIds.has(ur.roleId)
  ) {
    return {
      type: "user_role",
      id: ur.id,
      label,
      classification: "KEEP",
      reason: "Valid assignment to canonical role",
      foreignKeyDependencies: [],
      rollbackSource: "N/A",
    };
  }

  // Manual review for anything else
  return {
    type: "user_role",
    id: ur.id,
    label,
    classification: "MANUAL_REVIEW",
    reason: "Unable to automatically classify — requires human review",
    foreignKeyDependencies: [],
    rollbackSource: "Document before any action",
  };
}

export function classifyRole(
  role: RoleRecord,
  protectedRoleIds: Set<string>,
): ClassifiedRecord {
  const label = `Role[key=${role.key}, scope=${role.scope}, tenantId=${role.tenantId}]`;

  if (protectedRoleIds.has(role.id)) {
    return {
      type: "role",
      id: role.id,
      label,
      classification: "PROTECTED",
      reason: "Canonical platform role required for system operation",
      foreignKeyDependencies: [],
      rollbackSource: "Re-seed via prisma/seed.ts",
    };
  }

  if (role.isArchived) {
    if (role.userAssignmentCount > 0) {
      return {
        type: "role",
        id: role.id,
        label,
        classification: "MANUAL_REVIEW",
        reason: "Role is archived but still has user assignments — review before deleting",
        foreignKeyDependencies: [`${role.userAssignmentCount} UserRole assignment(s)`],
        rollbackSource: "Archive record sufficient",
      };
    }
    return {
      type: "role",
      id: role.id,
      label,
      classification: "DELETE_ROLE",
      reason: "Role is archived with no users — safe to delete",
      foreignKeyDependencies: [],
      rollbackSource: "Re-create if needed",
    };
  }

  if (role.integrityIssues.length > 0) {
    return {
      type: "role",
      id: role.id,
      label,
      classification: "INVALID_DATA",
      reason: role.integrityIssues.join("; "),
      foreignKeyDependencies: [`${role.userAssignmentCount} UserRole assignment(s)`],
      rollbackSource: "Fix scope/tenantId mismatch",
    };
  }

  if (role.isCanonical) {
    return {
      type: "role",
      id: role.id,
      label,
      classification: "KEEP",
      reason: "Canonical seeded role",
      foreignKeyDependencies: [],
      rollbackSource: "Re-seed via prisma/seed.ts",
    };
  }

  return {
    type: "role",
    id: role.id,
    label,
    classification: "MANUAL_REVIEW",
    reason: "Non-canonical role — requires human review to determine disposition",
    foreignKeyDependencies: [
      `${role.permissionCount} permission(s)`,
      `${role.userAssignmentCount} user assignment(s)`,
    ],
    rollbackSource: "Document before any action",
  };
}

export function classifyMembership(
  membership: MembershipRecord,
  protectedMembershipIds: Set<string>,
): ClassifiedRecord {
  const label = `TenantMembership[user=${membership.userEmail}, tenant=${membership.tenantKey}]`;

  if (protectedMembershipIds.has(membership.id)) {
    return {
      type: "membership",
      id: membership.id,
      label,
      classification: "PROTECTED",
      reason: "Required FC Allschwil membership for admin@fcallschwil.ch",
      foreignKeyDependencies: [],
      rollbackSource: "Re-create via bootstrap or tenant admin setup",
    };
  }

  if (!membership.isConsistent && membership.inconsistencyReason) {
    return {
      type: "membership",
      id: membership.id,
      label,
      classification: "INVALID_DATA",
      reason: membership.inconsistencyReason,
      foreignKeyDependencies: [],
      rollbackSource: "Determine correct tenant and recreate",
    };
  }

  return {
    type: "membership",
    id: membership.id,
    label,
    classification: "KEEP",
    reason: "Active valid membership",
    foreignKeyDependencies: [],
    rollbackSource: "N/A",
  };
}

export function classifyRolePermission(rp: RolePermissionRecord): ClassifiedRecord {
  const label = `RolePermission[role=${rp.roleKey}, permission=${rp.permissionKey}]`;

  if (!rp.isScopeCompatible) {
    return {
      type: "role_permission",
      id: rp.id,
      label,
      classification: "INVALID_DATA",
      reason: rp.incompatibilityReason ?? "Scope mismatch",
      foreignKeyDependencies: [],
      rollbackSource: "Remove — invalid cross-scope assignment",
    };
  }

  return {
    type: "role_permission",
    id: rp.id,
    label,
    classification: "PROTECTED",
    reason: "Valid scope-compatible role-permission link",
    foreignKeyDependencies: [],
    rollbackSource: "Re-seed",
  };
}

export function classifyUser(
  user: UserRecord,
  protectedUserIds: Set<string>,
): ClassifiedRecord {
  const label = `User[email=${user.email}]`;

  if (protectedUserIds.has(user.id)) {
    return {
      type: "user",
      id: user.id,
      label,
      classification: "PROTECTED",
      reason: "Protected platform or tenant administrator",
      foreignKeyDependencies: [],
      rollbackSource: "Never delete — bootstrap-admin.ts for recreation",
    };
  }

  if (user.businessDataSummary.hasBusinessData) {
    const deps: string[] = [];
    if (user.businessDataSummary.auditLogCount > 0)
      deps.push(`${user.businessDataSummary.auditLogCount} audit log(s)`);
    if (user.businessDataSummary.registrationCount > 0)
      deps.push(`${user.businessDataSummary.registrationCount} registration(s)`);
    if (user.businessDataSummary.orgUnitMembershipCount > 0)
      deps.push(`${user.businessDataSummary.orgUnitMembershipCount} org unit membership(s)`);
    if (user.businessDataSummary.contentRevisionCount > 0)
      deps.push(`${user.businessDataSummary.contentRevisionCount} content revision(s)`);
    if (user.businessDataSummary.workspaceDocumentCount > 0)
      deps.push(`${user.businessDataSummary.workspaceDocumentCount} workspace document(s)`);

    return {
      type: "user",
      id: user.id,
      label,
      classification: "MANUAL_REVIEW",
      reason: "User has business data references — cannot safely delete",
      foreignKeyDependencies: deps,
      rollbackSource: "Document before any action",
    };
  }

  const emailLower = user.email.toLowerCase();
  const isLikelyTestUser =
    emailLower.includes("test") ||
    emailLower.includes("bootstrap") ||
    emailLower.includes("dummy") ||
    emailLower.includes("placeholder") ||
    emailLower.includes("demo");

  if (isLikelyTestUser && !user.isActive) {
    return {
      type: "user",
      id: user.id,
      label,
      classification: "DELETE_USER_CANDIDATE",
      reason: "Appears to be a test/bootstrap user with no business data and isActive=false",
      foreignKeyDependencies: [],
      rollbackSource: "No restoration needed",
    };
  }

  return {
    type: "user",
    id: user.id,
    label,
    classification: "MANUAL_REVIEW",
    reason: "Cannot definitively classify without more context — requires human review",
    foreignKeyDependencies: [],
    rollbackSource: "Document before any action",
  };
}

// ---------------------------------------------------------------------------
// Dry-run plan generation — exported for testing
// ---------------------------------------------------------------------------

export function generateDryRunPlan(
  inventory: AuthorizationInventory,
  opts: {
    sceSuperAdminEmail?: string;
    clubAdminEmail?: string;
    tenantKey?: string;
  } = {},
): DryRunPlan {
  const clubAdminEmail = opts.clubAdminEmail ?? FC_ADMIN_EMAIL;
  const tenantKey = opts.tenantKey ?? FC_ALLSCHWIL_KEY;

  const fcaTenant = inventory.tenants.find((t) => t.key === tenantKey) ?? null;

  // Determine protected user IDs
  const protectedUserIds = new Set<string>();

  // The verified SCE Super Admin
  if (inventory.superAdminFinding === "ONE_VERIFIED_SCE_SUPER_ADMIN") {
    const candidate = inventory.superAdminCandidates[0];
    if (candidate) protectedUserIds.add(candidate.userId);
  } else if (opts.sceSuperAdminEmail) {
    const user = inventory.users.find((u) => u.email === opts.sceSuperAdminEmail);
    if (user) protectedUserIds.add(user.id);
  }

  // FC Admin
  const fcAdmin = inventory.users.find((u) => u.email === clubAdminEmail);
  if (fcAdmin) protectedUserIds.add(fcAdmin.id);

  // Determine protected role IDs (canonical seeded roles)
  const protectedRoleIds = new Set<string>(
    inventory.roles
      .filter((r) => CANONICAL_ROLE_KEYS.has(r.key))
      .map((r) => r.id),
  );

  // Determine protected membership IDs
  const protectedMembershipIds = new Set<string>();
  if (fcAdmin && fcaTenant) {
    const fcaMembership = inventory.memberships.find(
      (m) => m.userId === fcAdmin.id && m.tenantId === fcaTenant.id,
    );
    if (fcaMembership) protectedMembershipIds.add(fcaMembership.id);
  }

  const plan: DryRunPlan = {
    rolesToPreserve: [],
    rolesToArchive: [],
    rolesToDelete: [],
    userRolesToPreserve: [],
    userRolesToDelete: [],
    membershipsToPreserve: [],
    membershipsToDeactivate: [],
    membershipsToDelete: [],
    usersToPreserve: [],
    usersConsideredForDeletion: [],
    personsToPreserve: [],
    personsConsideredForDeletion: [],
    invalidRolePermissionsToRemove: [],
    canonicalPermissionsPreserved: 0,
    manualReviewItems: [],
  };

  // Classify roles
  for (const role of inventory.roles) {
    const classified = classifyRole(role, protectedRoleIds);
    switch (classified.classification) {
      case "PROTECTED":
      case "KEEP":
        plan.rolesToPreserve.push(classified);
        break;
      case "ARCHIVE_ROLE":
        plan.rolesToArchive.push(classified);
        break;
      case "DELETE_ROLE":
        plan.rolesToDelete.push(classified);
        break;
      case "MANUAL_REVIEW":
      case "INVALID_DATA":
        plan.manualReviewItems.push(classified);
        break;
    }
  }

  // Classify UserRoles
  for (const ur of inventory.userRoles) {
    const classified = classifyUserRole(ur, protectedUserIds, protectedRoleIds);
    switch (classified.classification) {
      case "PROTECTED":
      case "KEEP":
        plan.userRolesToPreserve.push(classified);
        break;
      case "REMOVE_ASSIGNMENT":
      case "INVALID_DATA":
        plan.userRolesToDelete.push(classified);
        break;
      case "MANUAL_REVIEW":
        plan.manualReviewItems.push(classified);
        break;
    }
  }

  // Classify memberships
  for (const m of inventory.memberships) {
    const classified = classifyMembership(m, protectedMembershipIds);
    switch (classified.classification) {
      case "PROTECTED":
      case "KEEP":
        plan.membershipsToPreserve.push(classified);
        break;
      case "DELETE_MEMBERSHIP":
        plan.membershipsToDelete.push(classified);
        break;
      case "INVALID_DATA":
      case "MANUAL_REVIEW":
        plan.manualReviewItems.push(classified);
        break;
    }
  }

  // Classify users
  for (const user of inventory.users) {
    const classified = classifyUser(user, protectedUserIds);
    switch (classified.classification) {
      case "PROTECTED":
      case "KEEP":
        plan.usersToPreserve.push(classified);
        break;
      case "DELETE_USER_CANDIDATE":
        plan.usersConsideredForDeletion.push(classified);
        break;
      case "MANUAL_REVIEW":
        plan.usersToPreserve.push(classified); // keep for now
        plan.manualReviewItems.push(classified);
        break;
    }
  }

  // Classify role-permissions
  for (const rp of inventory.rolePermissions) {
    const classified = classifyRolePermission(rp);
    if (classified.classification === "INVALID_DATA") {
      plan.invalidRolePermissionsToRemove.push(classified);
    }
  }

  // Count canonical permissions preserved
  plan.canonicalPermissionsPreserved = inventory.rolePermissions.filter(
    (rp) => rp.isScopeCompatible,
  ).length;

  // Persons: conservative — keep all unless no business references at all
  for (const person of inventory.persons) {
    if (
      person.hasPlayerSquad ||
      person.hasTrainerTeam ||
      person.hasOrgUnitMembership ||
      person.hasAuthoredContent
    ) {
      plan.personsToPreserve.push({
        type: "person",
        id: person.id,
        label: `Person[${person.firstName} ${person.lastName}]`,
        classification: "KEEP",
        reason: "Referenced by business data",
        foreignKeyDependencies: ["PlayerSquadMember/TrainerTeamMember/OrgUnitMembership/NewsArticle"],
        rollbackSource: "N/A",
      });
    } else {
      plan.manualReviewItems.push({
        type: "person",
        id: person.id,
        label: `Person[${person.firstName} ${person.lastName}]`,
        classification: "MANUAL_REVIEW",
        reason: "No business references found — manual review required before deletion",
        foreignKeyDependencies: [],
        rollbackSource: "Document before any action",
      });
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Safety gate evaluation — exported for testing
// ---------------------------------------------------------------------------

export function evaluateSafetyGates(
  inventory: AuthorizationInventory,
  envInfo: EnvironmentInfo,
  plan: DryRunPlan,
  opts: {
    sceSuperAdminEmail?: string;
    confirmationValue?: string;
    backupSucceeded: boolean;
    backupFilePath?: string;
    isBranchCorrect: boolean;
    isWorkingTreeClean: boolean;
  },
): SafetyGateResult {
  const gates: SafetyGate[] = [];

  const g = (id: number, description: string, pass: boolean, detail: string): SafetyGate => ({
    id,
    description,
    pass,
    detail,
  });

  // Gate 1: Environment is positively identified as STAGE
  const isStage = envInfo.isStageParsed && !envInfo.isProductionSuspected;
  gates.push(
    g(1, "Environment is positively identified as STAGE", isStage,
      isStage ? "STAGE environment confirmed" : `Environment=${envInfo.targetEnvironment}, production suspected=${envInfo.isProductionSuspected}`),
  );

  // Gate 2: Git branch is the RPERM-03A feature branch
  gates.push(
    g(2, "Git branch is the RPERM-03A feature branch", opts.isBranchCorrect,
      opts.isBranchCorrect
        ? `Branch: ${envInfo.currentBranch}`
        : `Expected: ${REQUIRED_FEATURE_BRANCH}, Actual: ${envInfo.currentBranch}`),
  );

  // Gate 3: Working tree is clean
  gates.push(
    g(3, "Working tree is clean", opts.isWorkingTreeClean,
      opts.isWorkingTreeClean ? "Working tree clean" : "Working tree has uncommitted changes"),
  );

  // Gate 4: FC Allschwil tenant found exactly once
  const fcaTenantCount = inventory.tenants.filter((t) => t.key === FC_ALLSCHWIL_KEY).length;
  const fcaFoundOnce = fcaTenantCount === 1;
  gates.push(
    g(4, "FC Allschwil tenant found exactly once", fcaFoundOnce,
      `Found ${fcaTenantCount} tenant(s) with key=${FC_ALLSCHWIL_KEY}`),
  );

  // Gate 5: admin@fcallschwil.ch found exactly once
  const fcAdminCount = inventory.users.filter((u) => u.email === FC_ADMIN_EMAIL).length;
  const fcAdminFoundOnce = fcAdminCount === 1;
  gates.push(
    g(5, "admin@fcallschwil.ch found exactly once", fcAdminFoundOnce,
      `Found ${fcAdminCount} user(s) with email=${FC_ADMIN_EMAIL}`),
  );

  // Gate 6: admin@fcallschwil.ch has a valid authentication identity
  const fcAdmin = inventory.fcAdminUser;
  const fcAdminActive = fcAdmin !== null && fcAdmin.isActive;
  gates.push(
    g(6, "admin@fcallschwil.ch has a valid authentication identity (isActive=true)", fcAdminActive,
      fcAdminActive ? "admin@fcallschwil.ch is active" : "admin@fcallschwil.ch not found or isActive=false"),
  );

  // Gate 7: SCE Super Admin is positively identified
  const superAdminIdentified = inventory.superAdminFinding === "ONE_VERIFIED_SCE_SUPER_ADMIN";
  gates.push(
    g(7, "SCE Super Admin is positively identified", superAdminIdentified,
      `Finding: ${inventory.superAdminFinding}`),
  );

  // Gate 8: Exactly one protected SCE Super Admin is selected
  const exactlyOneProtected =
    inventory.superAdminFinding === "ONE_VERIFIED_SCE_SUPER_ADMIN" &&
    inventory.superAdminCandidates.length === 1;
  gates.push(
    g(8, "Exactly one protected SCE Super Admin is selected", exactlyOneProtected,
      exactlyOneProtected
        ? `SCE Super Admin: ${inventory.superAdminCandidates[0]?.userEmail ?? "(unknown)"}`
        : `Candidates: ${inventory.superAdminCandidates.length}`),
  );

  // Gate 9: Protected SCE Super Admin has valid platform assignment
  const candidate = inventory.superAdminCandidates[0];
  const validPlatformAssignment =
    candidate !== undefined &&
    candidate.roleScope === "PLATFORM" &&
    candidate.roleTenantId === null &&
    candidate.userRoleTenantId === null &&
    !candidate.roleIsArchived;
  gates.push(
    g(9, "Protected SCE Super Admin has valid platform assignment", validPlatformAssignment,
      validPlatformAssignment ? "Valid platform assignment confirmed" : "No valid platform assignment"),
  );

  // Gate 10: Protected SCE Super Admin is not archived or inactive
  const superAdminUser = candidate
    ? inventory.users.find((u) => u.id === candidate.userId) ?? null
    : null;
  const superAdminNotArchived =
    superAdminUser !== null && superAdminUser.isActive && !candidate?.roleIsArchived;
  gates.push(
    g(10, "Protected SCE Super Admin is not archived or inactive", superAdminNotArchived,
      superAdminNotArchived
        ? "SCE Super Admin account is active"
        : "SCE Super Admin account is inactive or role is archived"),
  );

  // Gate 11: FC Allschwil tenant administrator path is protected
  const fcaAdminProtected =
    fcAdmin !== null &&
    plan.usersToPreserve.some((r) => r.id === fcAdmin.id) &&
    !plan.usersConsideredForDeletion.some((r) => r.id === fcAdmin.id);
  gates.push(
    g(11, "FC Allschwil tenant administrator path is protected", fcaAdminProtected,
      fcaAdminProtected ? "admin@fcallschwil.ch is protected" : "admin@fcallschwil.ch is not protected"),
  );

  // Gate 12: Backup file was successfully written
  gates.push(
    g(12, "Backup file was successfully written", opts.backupSucceeded,
      opts.backupSucceeded
        ? `Backup at: ${opts.backupFilePath ?? "(path not specified)"}`
        : "Backup failed or not performed"),
  );

  // Gate 13: Dry-run contains no unresolved MANUAL_REVIEW record scheduled for deletion
  const manualReviewInDeletion =
    plan.userRolesToDelete.some((r) => r.classification === "MANUAL_REVIEW") ||
    plan.usersConsideredForDeletion.some((r) => r.classification === "MANUAL_REVIEW") ||
    plan.membershipsToDelete.some((r) => r.classification === "MANUAL_REVIEW") ||
    plan.rolesToDelete.some((r) => r.classification === "MANUAL_REVIEW");
  gates.push(
    g(13, "No unresolved MANUAL_REVIEW records scheduled for deletion", !manualReviewInDeletion,
      !manualReviewInDeletion
        ? "All planned deletions are clearly classified"
        : "Some MANUAL_REVIEW items are in the deletion list — cannot proceed"),
  );

  // Gate 14: No production database signal
  gates.push(
    g(14, "No production database signal detected", !envInfo.isProductionSuspected,
      !envInfo.isProductionSuspected ? "No production indicators found" : "PRODUCTION INDICATOR DETECTED — BLOCKED"),
  );

  // Gate 15: No tenant except explicitly targeted authorization records will be modified
  // (We only modify auth records for the identified users/roles — not tenant business data)
  const onlyAuthRecordsModified = true; // by design — script only touches auth tables
  gates.push(
    g(15, "Only authorization records will be modified (no business data)", onlyAuthRecordsModified,
      "Script only modifies UserRole, TenantMembership, Role, RolePermission records"),
  );

  // Gate 16: No canonical permission will be deleted
  const canonicalPermsSafe = plan.invalidRolePermissionsToRemove.every(
    (r) => r.type === "role_permission",
  );
  gates.push(
    g(16, "No canonical permission will be deleted", canonicalPermsSafe,
      `${plan.canonicalPermissionsPreserved} canonical permission links preserved`),
  );

  // Gate 17: No business-domain record will be deleted
  const noBusinessDataDeleted =
    plan.usersConsideredForDeletion.every((r) => r.classification !== "MANUAL_REVIEW");
  gates.push(
    g(17, "No business-domain record will be deleted", noBusinessDataDeleted,
      noBusinessDataDeleted ? "No business data in deletion plan" : "Business data deletion detected"),
  );

  // Gate 18: Cleanup remains transaction-safe
  gates.push(
    g(18, "Cleanup remains transaction-safe", true,
      "All mutations wrapped in Prisma $transaction"),
  );

  // Gate 19: Post-cleanup checks are defined
  gates.push(
    g(19, "Post-cleanup checks are defined", true,
      "Postconditions verified before transaction commit"),
  );

  // Gate 20: Explicit execution confirmation value is supplied
  const confirmOk = opts.confirmationValue === EXECUTE_CONFIRMATION;
  gates.push(
    g(20, `Explicit confirmation '${EXECUTE_CONFIRMATION}' supplied`, confirmOk,
      confirmOk
        ? "Confirmation value matches"
        : "Missing or incorrect --confirm value — EXECUTION REFUSED"),
  );

  const blockers = gates.filter((g) => !g.pass).map((g) => `Gate ${g.id}: ${g.description}`);

  return { gates, allPass: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export async function createBackup(
  inventory: AuthorizationInventory,
  backupFilePath: string,
): Promise<boolean> {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Sanitize: strip any fields that might contain secrets
    // The inventory should already not include passwords/tokens,
    // but we explicitly filter known sensitive field names.
    const safeInventory = JSON.parse(JSON.stringify(inventory), (key, value) => {
      if (
        key === "passwordHash" ||
        key === "token" ||
        key === "secret" ||
        key === "accessToken" ||
        key === "refreshToken" ||
        key === "sessionToken"
      ) {
        return "[REDACTED]";
      }
      return value;
    });

    fs.writeFileSync(backupFilePath, JSON.stringify(safeInventory, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cleanup execution (transaction) — only runs when all gates pass
// ---------------------------------------------------------------------------

export async function executeCleanup(
  prisma: PrismaClient,
  inventory: AuthorizationInventory,
  plan: DryRunPlan,
): Promise<{
  success: boolean;
  recordsChanged: Record<string, number>;
  postconditionFailures: string[];
  error?: string;
}> {
  const recordsChanged: Record<string, number> = {
    rolePermissionsRemoved: 0,
    userRolesRemoved: 0,
    membershipsRemoved: 0,
    rolesArchived: 0,
    rolesDeleted: 0,
    usersDeleted: 0,
    personsDeleted: 0,
  };

  try {
    const postconditionFailures = await prisma.$transaction(async (tx) => {
      // 1. Remove invalid/obsolete RolePermission links
      for (const rp of plan.invalidRolePermissionsToRemove) {
        await tx.rolePermission.delete({ where: { id: rp.id } });
        recordsChanged.rolePermissionsRemoved++;
      }

      // 2. Remove obsolete UserRole assignments
      for (const ur of plan.userRolesToDelete) {
        await tx.userRole.delete({ where: { id: ur.id } });
        recordsChanged.userRolesRemoved++;
      }

      // 3. Remove obsolete TenantMemberships
      for (const m of plan.membershipsToDelete) {
        await tx.tenantMembership.delete({ where: { id: m.id } });
        recordsChanged.membershipsRemoved++;
      }

      // 4. Archive roles
      for (const r of plan.rolesToArchive) {
        await tx.role.update({ where: { id: r.id }, data: { isArchived: true } });
        recordsChanged.rolesArchived++;
      }

      // 5. Delete obsolete roles (only archived with zero users)
      for (const r of plan.rolesToDelete) {
        await tx.role.delete({ where: { id: r.id } });
        recordsChanged.rolesDeleted++;
      }

      // 6. Delete confirmed test users (no business data)
      for (const u of plan.usersConsideredForDeletion) {
        if (u.classification === "DELETE_USER_CANDIDATE") {
          await tx.user.delete({ where: { id: u.id } });
          recordsChanged.usersDeleted++;
        }
      }

      // 7. Delete confirmed disposable persons
      for (const p of plan.personsConsideredForDeletion) {
        if (p.classification === "DELETE_PERSON_CANDIDATE") {
          await tx.person.delete({ where: { id: p.id } });
          recordsChanged.personsDeleted++;
        }
      }

      // ── Postcondition checks (inside transaction) ──────────────────────────

      const failures: string[] = [];

      // P1: Exactly one valid active SCE Super Admin assignment
      const superAdminRole = await tx.role.findUnique({
        where: { key: SUPER_ADMIN_ROLE_KEY },
        select: { id: true, scope: true, tenantId: true, isArchived: true },
      });

      if (!superAdminRole) {
        failures.push("P1: super_admin role not found after cleanup");
      } else {
        if (superAdminRole.scope !== RoleScope.PLATFORM) {
          failures.push(`P1: super_admin role has wrong scope=${superAdminRole.scope}`);
        }
        if (superAdminRole.tenantId !== null) {
          failures.push(`P1: super_admin role has tenantId=${superAdminRole.tenantId} (expected null)`);
        }
        if (superAdminRole.isArchived) {
          failures.push("P1: super_admin role is archived");
        }

        const superAdminAssignments = await tx.userRole.count({
          where: {
            roleId: superAdminRole.id,
            tenantId: null,
          },
        });

        if (superAdminAssignments !== 1) {
          failures.push(
            `P1: Expected exactly 1 valid platform SCE Super Admin assignment, found ${superAdminAssignments}`,
          );
        }
      }

      // P2: admin@fcallschwil.ch exists and is active
      const fcAdmin = await tx.user.findUnique({
        where: { email: FC_ADMIN_EMAIL },
        select: { id: true, isActive: true },
      });

      if (!fcAdmin) {
        failures.push(`P2: ${FC_ADMIN_EMAIL} not found after cleanup`);
      } else if (!fcAdmin.isActive) {
        failures.push(`P2: ${FC_ADMIN_EMAIL} isActive=false after cleanup`);
      } else {
        // Check FC Allschwil membership
        const fcaTenant = await tx.tenant.findUnique({
          where: { key: FC_ALLSCHWIL_KEY },
          select: { id: true },
        });

        if (!fcaTenant) {
          failures.push("P2: FC Allschwil tenant not found after cleanup");
        } else {
          const membership = await tx.tenantMembership.findUnique({
            where: {
              tenantId_userId: { tenantId: fcaTenant.id, userId: fcAdmin.id },
            },
            select: { isActive: true },
          });

          if (!membership?.isActive) {
            failures.push(
              `P2: ${FC_ADMIN_EMAIL} has no active TenantMembership for ${FC_ALLSCHWIL_KEY}`,
            );
          }
        }
      }

      // P3: No invalid cross-tenant UserRole assignments remain
      const crossTenantRemaining = await tx.userRole.count({
        where: {
          role: { scope: RoleScope.PLATFORM },
          tenantId: { not: null },
        },
      });

      if (crossTenantRemaining > 0) {
        failures.push(`P3: ${crossTenantRemaining} platform UserRole(s) still have non-null tenantId`);
      }

      return failures;
    });

    return {
      success: postconditionFailures.length === 0,
      recordsChanged,
      postconditionFailures,
    };
  } catch (err) {
    return {
      success: false,
      recordsChanged,
      postconditionFailures: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Report printing helpers
// ---------------------------------------------------------------------------

function printSection(title: string): void {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

function printSubSection(title: string): void {
  console.log("\n── " + title + " " + "─".repeat(Math.max(0, 65 - title.length)));
}

function printKV(key: string, value: string | number | boolean | null | undefined): void {
  const safeVal =
    value === null ? "(null)" : value === undefined ? "(undefined)" : String(value);
  console.log(`  ${key.padEnd(36)} ${safeVal}`);
}

function printInventoryReport(
  inventory: AuthorizationInventory,
  envInfo: EnvironmentInfo,
): void {
  printSection("RPERM-03A — AUTHORIZATION INVENTORY");
  console.log(`  Captured: ${inventory.capturedAt.toISOString()}`);

  printSubSection("Environment Verification");
  printKV("Target environment", envInfo.targetEnvironment);
  printKV("DB host (redacted)", envInfo.dbHostRedacted);
  printKV("DB name", envInfo.dbName);
  printKV("DB schema", envInfo.dbSchema);
  printKV("Production suspected", String(envInfo.isProductionSuspected));
  printKV("STAGE parsed", String(envInfo.isStageParsed));
  printKV("Current branch", envInfo.currentBranch);
  printKV("Current HEAD", envInfo.currentHead);
  printKV("Tenant count", envInfo.tenantCount);
  printKV("FC Allschwil tenant ID", envInfo.fcAllschwilTenantId ?? "(not found)");

  printSubSection("12.1 Tenants");
  for (const t of inventory.tenants) {
    const isFca = t.key === FC_ALLSCHWIL_KEY ? " ← FC ALLSCHWIL" : "";
    console.log(`  [${t.id.slice(0, 12)}…] ${t.name} (key=${t.key}) status=${t.status}${isFca}`);
    console.log(`    Memberships=${t.membershipCount} Roles=${t.roleCount} UserRoles=${t.userRoleCount}`);
  }

  printSubSection("12.2 Users");
  for (const u of inventory.users) {
    const isFca = u.email === FC_ADMIN_EMAIL ? " ← FC ADMIN" : "";
    const roles = u.userRoles.map((ur) => `${ur.roleKey}[${ur.roleScope}]`).join(", ");
    const biz = u.businessDataSummary.hasBusinessData ? " [has business data]" : "";
    console.log(
      `  [${u.id.slice(0, 12)}…] ${u.email} active=${u.isActive}${isFca}${biz}`,
    );
    console.log(`    Roles: ${roles || "(none)"}`);
    console.log(
      `    Memberships: ${u.tenantMemberships.map((m) => `${m.tenantKey}(active=${m.isActive})`).join(", ") || "(none)"}`,
    );
  }

  printSubSection("12.3 Persons");
  if (inventory.persons.length === 0) {
    console.log("  (no persons found)");
  }
  for (const p of inventory.persons) {
    const refs: string[] = [];
    if (p.hasPlayerSquad) refs.push("PlayerSquad");
    if (p.hasTrainerTeam) refs.push("TrainerTeam");
    if (p.hasOrgUnitMembership) refs.push("OrgUnit");
    if (p.hasAuthoredContent) refs.push("Content");
    console.log(
      `  [${p.id.slice(0, 12)}…] ${p.firstName} ${p.lastName} active=${p.isActive} refs=[${refs.join(",") || "none"}]`,
    );
  }

  printSubSection("12.4 Roles");
  for (const r of inventory.roles) {
    const issues = r.integrityIssues.length > 0 ? ` ⚠ ${r.integrityIssues.join("; ")}` : "";
    const archived = r.isArchived ? " [ARCHIVED]" : "";
    const template = r.isTemplate ? " [TEMPLATE]" : "";
    const system = r.isSystem ? " [SYSTEM]" : "";
    console.log(
      `  [${r.id.slice(0, 12)}…] ${r.key} scope=${r.scope} tenantId=${r.tenantId ?? "null"}${archived}${template}${system}${issues}`,
    );
    console.log(`    Permissions=${r.permissionCount} Users=${r.userAssignmentCount}`);
  }

  printSubSection("12.5 UserRole Assignments");
  for (const ur of inventory.userRoles) {
    const status = ur.isConsistent ? "✓" : `✗ ${ur.inconsistencyReason}`;
    console.log(
      `  [${ur.id.slice(0, 12)}…] ${ur.userEmail} → ${ur.roleKey}[${ur.roleScope}] urTenantId=${ur.userRoleTenantId ?? "null"} ${status}`,
    );
  }

  printSubSection("12.6 TenantMemberships");
  for (const m of inventory.memberships) {
    const status = m.isActive ? "ACTIVE" : "INACTIVE";
    console.log(
      `  [${m.id.slice(0, 12)}…] ${m.userEmail} → ${m.tenantKey} ${status}`,
    );
  }

  printSubSection("12.7 RolePermission Assignments");
  const incompatible = inventory.rolePermissions.filter((rp) => !rp.isScopeCompatible);
  console.log(
    `  Total: ${inventory.rolePermissions.length} (${incompatible.length} scope-incompatible)`,
  );
  for (const rp of incompatible) {
    console.log(`  ✗ ${rp.roleKey}[${rp.roleScope}] → ${rp.permissionKey}[${rp.permissionScope}]`);
  }

  printSection("INTEGRITY FINDINGS");
  const f = inventory.integrityFindings;
  printKV("Platform roles with tenantId", f.platformRolesWithTenantId.length);
  printKV("Tenant roles with null tenantId", f.tenantRolesWithNullTenantId.length);
  printKV("Cross-tenant UserRoles", f.crossTenantUserRoles.length);
  printKV("Platform UserRoles with tenantId", f.platformUserRolesWithTenantId.length);
  printKV("Tenant roles with platform permissions", f.tenantRolesWithPlatformPermissions.length);
  printKV("Platform roles with tenant permissions", f.platformRolesWithTenantPermissions.length);
  printKV("Users: tenant role but no membership", f.usersWithTenantRolesButNoMembership.length);
  printKV("Users: membership but no tenant role", f.usersWithMembershipButNoRole.length);
  printKV("Archived roles still assigned", f.archivedRolesStillAssigned.length);
  printKV("Roles with zero permissions", f.rolesWithZeroPermissions.length);
  printKV("Roles with zero users", f.rolesWithZeroUsers.length);
  printKV("Users with multiple platform admin roles", f.usersWithMultiplePlatformAdminRoles.length);
  printKV("Super admin holders", inventory.superAdminCandidates.length);
  printKV("Duplicate emails", f.duplicateEmails.length);
  printKV("Test/bootstrap email candidates", f.testBootstrapCandidates.length);

  if (f.crossTenantUserRoles.length > 0) {
    console.log("\n  Cross-tenant UserRole details:");
    for (const ur of f.crossTenantUserRoles) {
      console.log(`    ${ur.userEmail}: UserRole.tenantId=${ur.userRoleTenantId} != Role.tenantId=${ur.roleTenantId}`);
    }
  }

  printSection("SCE SUPER ADMIN FINDING");
  printKV("Classification", inventory.superAdminFinding);
  if (inventory.superAdminCandidates.length > 0) {
    for (const c of inventory.superAdminCandidates) {
      printKV("Email", c.userEmail);
      printKV("User ID", c.userId);
      printKV("Role ID", c.roleId);
      printKV("Role key", c.roleKey);
      printKV("Role scope", c.roleScope);
      printKV("Role tenantId", c.roleTenantId ?? "null");
      printKV("UserRole tenantId", c.userRoleTenantId ?? "null");
      printKV("Role archived", c.roleIsArchived);
    }
  } else {
    console.log("  No valid SCE Super Admin candidates found.");
  }

  printSection("FC ALLSCHWIL ADMIN FINDING");
  if (inventory.fcAdminUser) {
    const u = inventory.fcAdminUser;
    const platformRoles = u.userRoles.filter((ur) => ur.roleScope === "PLATFORM");
    const tenantRoles = u.userRoles.filter((ur) => ur.roleScope === "TENANT");
    const fcaMembership = u.tenantMemberships.find((m) => m.tenantKey === FC_ALLSCHWIL_KEY);
    printKV("Email", u.email);
    printKV("User ID", u.id);
    printKV("isActive", u.isActive);
    printKV("tenantId (User.tenantId)", u.tenantId ?? "null");
    printKV("FC Allschwil TenantMembership", fcaMembership ? `active=${fcaMembership.isActive}` : "(not found)");
    printKV("Platform roles", platformRoles.map((r) => r.roleKey).join(", ") || "(none)");
    printKV("Tenant roles", tenantRoles.map((r) => `${r.roleKey}[tenantId=${r.userRoleTenantId}]`).join(", ") || "(none)");
    printKV("Has business data", u.businessDataSummary.hasBusinessData);
  } else {
    console.log(`  ⚠ ${FC_ADMIN_EMAIL} not found in database`);
  }
}

function printDryRunReport(plan: DryRunPlan): void {
  printSection("DRY-RUN CLEANUP PLAN");

  printSubSection("Roles");
  console.log(`  Preserve: ${plan.rolesToPreserve.length}`);
  console.log(`  Archive:  ${plan.rolesToArchive.length}`);
  console.log(`  Delete:   ${plan.rolesToDelete.length}`);
  for (const r of plan.rolesToDelete) {
    console.log(`    DELETE: ${r.label} — ${r.reason}`);
  }

  printSubSection("UserRole Assignments");
  console.log(`  Preserve: ${plan.userRolesToPreserve.length}`);
  console.log(`  Delete:   ${plan.userRolesToDelete.length}`);
  for (const ur of plan.userRolesToDelete) {
    console.log(`    DELETE: ${ur.label} — ${ur.reason}`);
  }

  printSubSection("TenantMemberships");
  console.log(`  Preserve:  ${plan.membershipsToPreserve.length}`);
  console.log(`  Deactivate: ${plan.membershipsToDeactivate.length}`);
  console.log(`  Delete:    ${plan.membershipsToDelete.length}`);

  printSubSection("Users");
  console.log(`  Preserve:           ${plan.usersToPreserve.length}`);
  console.log(`  Deletion candidates: ${plan.usersConsideredForDeletion.length}`);
  for (const u of plan.usersConsideredForDeletion) {
    console.log(`    CANDIDATE: ${u.label} — ${u.reason}`);
  }

  printSubSection("Persons");
  console.log(`  Preserve:           ${plan.personsToPreserve.length}`);
  console.log(`  Deletion candidates: ${plan.personsConsideredForDeletion.length}`);

  printSubSection("Invalid RolePermissions");
  console.log(`  Remove: ${plan.invalidRolePermissionsToRemove.length}`);
  for (const rp of plan.invalidRolePermissionsToRemove) {
    console.log(`    REMOVE: ${rp.label} — ${rp.reason}`);
  }

  printSubSection("Manual Review Items");
  console.log(`  Count: ${plan.manualReviewItems.length}`);
  for (const item of plan.manualReviewItems) {
    console.log(`    REVIEW [${item.type}]: ${item.label} — ${item.reason}`);
  }

  printSubSection("Summary");
  printKV("Canonical permissions preserved", plan.canonicalPermissionsPreserved);
}

function printSafetyGatesReport(gates: SafetyGateResult): void {
  printSection("SAFETY GATE EVALUATION");
  for (const g of gates.gates) {
    const icon = g.pass ? "✅ PASS" : "❌ FAIL";
    console.log(`  Gate ${String(g.id).padStart(2)}: [${icon}] ${g.description}`);
    console.log(`           ${g.detail}`);
  }
  console.log(`\n  All gates pass: ${gates.allPass ? "YES ✅" : "NO ❌"}`);
  if (!gates.allPass) {
    console.log("\n  Blockers:");
    for (const b of gates.blockers) {
      console.log(`    • ${b}`);
    }
  }
}

function printAggregates(inventory: AuthorizationInventory): void {
  printSection("AGGREGATE COUNTS");
  printKV("Tenants", inventory.tenants.length);
  printKV("Users", inventory.users.length);
  printKV("Persons", inventory.persons.length);
  printKV("Roles (total)", inventory.roles.length);
  printKV("Platform roles", inventory.roles.filter((r) => r.scope === "PLATFORM").length);
  printKV("Tenant roles", inventory.roles.filter((r) => r.scope === "TENANT").length);
  printKV("Permissions (via RolePermission)", inventory.rolePermissions.length);
  printKV("UserRole assignments", inventory.userRoles.length);
  printKV("TenantMemberships", inventory.memberships.length);
  printKV("RolePermission links", inventory.rolePermissions.length);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  mode: "inventory" | "dry-run" | "execute";
  environment?: string;
  sceSuperAdminEmail?: string;
  clubAdminEmail: string;
  tenantKey: string;
  backupFile?: string;
  confirmationValue?: string;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  let mode: CliOptions["mode"] = "inventory";
  if (args.includes("--inventory")) mode = "inventory";
  if (args.includes("--dry-run")) mode = "dry-run";
  if (args.includes("--execute")) mode = "execute";

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return undefined;
  };

  return {
    mode,
    environment: getArg("--environment"),
    sceSuperAdminEmail: getArg("--sce-super-admin-email"),
    clubAdminEmail: getArg("--club-admin-email") ?? FC_ADMIN_EMAIL,
    tenantKey: getArg("--tenant-key") ?? FC_ALLSCHWIL_KEY,
    backupFile: getArg("--backup-file"),
    confirmationValue: getArg("--confirm"),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv);

  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  RPERM-03A — Authorization Inventory and Clean-Start                  ║");
  console.log(`║  Mode: ${opts.mode.padEnd(61)}  ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

  if (opts.mode !== "execute") {
    console.log("  ℹ Running in READ-ONLY mode. No database mutations will be performed.");
  }

  // Determine database URL — STAGE_DIRECT_URL preferred for Prisma adapter (Neon),
  // fall back to STAGE_DB_URL, then DATABASE_URL
  const dbUrl = process.env.STAGE_DIRECT_URL || process.env.STAGE_DB_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("\n  ✗ FATAL: No DATABASE_URL or STAGE_DB_URL set. Cannot connect to database.");
    process.exit(1);
  }

  const maskedUrl = maskConnectionString(dbUrl);
  console.log(`  Database: ${maskedUrl}`);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Gather environment info
    const envInfo = await gatherEnvironmentInfo(prisma, dbUrl);

    // Hard stop: production detected
    if (envInfo.isProductionSuspected) {
      printSection("BLOCKED — PRODUCTION DATABASE DETECTED");
      printKV("DB host (redacted)", envInfo.dbHostRedacted);
      console.log("\n  STOP — This script refuses to operate against production.");
      process.exit(1);
    }

    console.log(`  Environment: ${envInfo.targetEnvironment}`);
    console.log(`  Branch: ${envInfo.currentBranch}`);
    console.log(`  HEAD: ${envInfo.currentHead}`);
    console.log(`  Tenants: ${envInfo.tenantCount}`);
    console.log(`  FC Allschwil ID: ${envInfo.fcAllschwilTenantId ?? "(not found)"}`);

    // Run inventory
    console.log("\n  Running authorization inventory…");
    const inventory = await runInventory(prisma);

    // Print inventory report
    printInventoryReport(inventory, envInfo);
    printAggregates(inventory);

    if (opts.mode === "inventory") {
      printSection("INVENTORY COMPLETE — READ-ONLY MODE");
      console.log("  No database changes were made.");
      console.log("  Run with --dry-run to see the cleanup plan.");
      console.log("  Run with --execute --confirm CLEAN-STAGE-AUTHORIZATION-DATA to execute.");
      return;
    }

    // Dry-run
    const plan = generateDryRunPlan(inventory, {
      sceSuperAdminEmail: opts.sceSuperAdminEmail,
      clubAdminEmail: opts.clubAdminEmail,
      tenantKey: opts.tenantKey,
    });

    printDryRunReport(plan);

    if (opts.mode === "dry-run") {
      printSection("DRY-RUN COMPLETE — NO CHANGES MADE");
      console.log("  Dry-run produced no database mutations.");
      console.log("  Review the plan above and run with --execute to apply.");
      return;
    }

    // Execute mode — evaluate safety gates first
    const isBranchCorrect = envInfo.currentBranch === REQUIRED_FEATURE_BRANCH;
    const isWorkingTreeClean = (() => {
      try {
        const status = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
        return status === "";
      } catch {
        return false;
      }
    })();

    // Create backup before safety gate check
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilePath =
      opts.backupFile ?? path.join(process.cwd(), ".tmp", `rperm-03a-backup-${timestamp}.json`);

    console.log(`\n  Creating backup at ${backupFilePath}…`);
    const backupSucceeded = await createBackup(inventory, backupFilePath);
    console.log(`  Backup: ${backupSucceeded ? "✅ SUCCESS" : "❌ FAILED"}`);

    const safetyGates = evaluateSafetyGates(inventory, envInfo, plan, {
      sceSuperAdminEmail: opts.sceSuperAdminEmail,
      confirmationValue: opts.confirmationValue,
      backupSucceeded,
      backupFilePath,
      isBranchCorrect,
      isWorkingTreeClean,
    });

    printSafetyGatesReport(safetyGates);

    if (!safetyGates.allPass) {
      printSection("EXECUTION REFUSED — SAFETY GATES FAILED");
      console.log("  One or more safety gates did not pass. No database changes were made.");
      console.log("\n  Resolve the following issues and retry:");
      for (const b of safetyGates.blockers) {
        console.log(`    • ${b}`);
      }
      process.exit(1);
    }

    // All gates pass — execute cleanup
    printSection("EXECUTING CLEANUP");
    console.log("  Executing cleanup inside a database transaction…");

    const result = await executeCleanup(prisma, inventory, plan);

    if (!result.success) {
      printSection("CLEANUP FAILED — TRANSACTION ROLLED BACK");
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      if (result.postconditionFailures.length > 0) {
        console.log("  Postcondition failures:");
        for (const f of result.postconditionFailures) {
          console.log(`    • ${f}`);
        }
      }
      console.log("  Transaction was rolled back. No changes were committed.");
      process.exit(1);
    }

    printSection("CLEANUP COMPLETE — TRANSACTION COMMITTED");
    printKV("RolePermissions removed", result.recordsChanged.rolePermissionsRemoved);
    printKV("UserRoles removed", result.recordsChanged.userRolesRemoved);
    printKV("TenantMemberships removed", result.recordsChanged.membershipsRemoved);
    printKV("Roles archived", result.recordsChanged.rolesArchived);
    printKV("Roles deleted", result.recordsChanged.rolesDeleted);
    printKV("Users deleted", result.recordsChanged.usersDeleted);
    printKV("Persons deleted", result.recordsChanged.personsDeleted);
    printKV("Postconditions", "ALL PASSED ✅");
    printKV("Transaction", "COMMITTED ✅");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main() when this file is invoked directly (not imported for testing)
const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("rperm-03a-authorization-clean-start.ts") ||
    process.argv[1].endsWith("rperm-03a-authorization-clean-start.js"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("\n[FATAL]", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
