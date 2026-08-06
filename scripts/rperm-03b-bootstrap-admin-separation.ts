/**
 * scripts/rperm-03b-bootstrap-admin-separation.ts
 *
 * RPERM-03B — Separate Platform Super Admin and FC Allschwil Club Admin
 *
 * Creates or validates two distinct administrator accounts:
 *
 *   hello@tulip-digital.ch → SCE Super Admin (PLATFORM role, no tenant membership)
 *   it@fcallschwil.ch      → FC Allschwil Club Admin (TENANT role, active membership)
 *
 * Preserves without changes:
 *   admin@fcallschwil.ch   → Legacy temporary fallback (not deleted, not deactivated)
 *
 * Modes:
 *   --inspect   Read-only: print current state of all three identities and roles.
 *   --dry-run   Read-only: plan what would be created/changed. Zero DB writes.
 *   --execute   Live execution. Requires --confirm SEPARATE-STAGE-PLATFORM-AND-TENANT-ADMINS
 *
 * Environment variables required for account creation:
 *   SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD   — password for hello@tulip-digital.ch
 *   FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD    — password for it@fcallschwil.ch
 *
 * Usage (inspect):
 *   npx tsx scripts/rperm-03b-bootstrap-admin-separation.ts --inspect
 *
 * Usage (dry-run):
 *   npx tsx scripts/rperm-03b-bootstrap-admin-separation.ts --dry-run
 *
 * Usage (execute):
 *   SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD=<...> \
 *   FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD=<...> \
 *   npx tsx scripts/rperm-03b-bootstrap-admin-separation.ts \
 *     --execute \
 *     --confirm SEPARATE-STAGE-PLATFORM-AND-TENANT-ADMINS
 *
 * Password reset flags (optional, requires --execute):
 *   --reset-platform-password    Reset hello@tulip-digital.ch password from env var
 *   --reset-club-admin-password  Reset it@fcallschwil.ch password from env var
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleScope, PermissionScope } from "@prisma/client";
import { Pool } from "pg";
import { hashPassword } from "@/lib/auth/password";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLATFORM_EMAIL = "hello@tulip-digital.ch";
export const CLUB_ADMIN_EMAIL = "it@fcallschwil.ch";
export const LEGACY_EMAIL = "admin@fcallschwil.ch";
export const TENANT_KEY = "fc-allschwil";
export const SUPER_ADMIN_ROLE_KEY = "super_admin";
export const TENANT_CLUB_ADMIN_ROLE_KEY = "club_admin_fc_allschwil";
export const TENANT_CLUB_ADMIN_ROLE_NAME = "Club Admin";
export const EXECUTE_CONFIRMATION = "SEPARATE-STAGE-PLATFORM-AND-TENANT-ADMINS";

// Minimum password length requirement
const MIN_PASSWORD_LENGTH = 8;

// All canonical TENANT-scoped permission keys (from seed.ts)
export const TENANT_PERMISSION_KEYS: readonly string[] = [
  "users.view",
  "users.invite",
  "users.manage_memberships",
  "roles.view",
  "roles.manage",
  "roles.assign",
  "seasons.view",
  "seasons.manage",
  "teams.view",
  "teams.manage",
  "people.view",
  "people.manage",
  "events.view",
  "events.manage",
  "events.import",
  "events.publish_website",
  "events.publish_infoboard",
  "fixtures.view",
  "fixtures.create",
  "fixtures.edit_all",
  "fixtures.submit_for_publication",
  "fixtures.publish_website",
  "fixtures.publish_infoboard",
  "wochenplan.manage",
  "news.manage",
  "website.manage",
  "infoboard.manage",
  "functions.manage",
  "targets.view",
  "targets.manage",
  "meetings.view",
  "meetings.manage",
  "initiatives.view",
  "initiatives.manage",
  "templates.view",
  "templates.manage",
  "registrations.view",
  "registrations.edit",
  "org.view",
  "org.manage",
  "facilities.view",
  "facilities.manage",
  "trainings.view",
  "trainings.manage",
  // RPERM-05: Workspace/Documents — see prisma/seed.ts for the same fix applied
  // to the canonical seed-driven tenant club_admin role.
  "workspace.view",
  "workspace.manage",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSummary {
  exists: boolean;
  id?: string;
  email?: string;
  isActive?: boolean;
  hasPasswordHash?: boolean;
  platformRoles: Array<{ roleId: string; roleKey: string; userRoleTenantId: string | null }>;
  tenantMemberships: Array<{ tenantId: string; tenantKey: string; isActive: boolean }>;
  tenantRoles: Array<{ roleId: string; roleKey: string; userRoleTenantId: string | null }>;
}

export interface RoleSummary {
  exists: boolean;
  id?: string;
  key?: string;
  name?: string;
  scope?: RoleScope;
  tenantId?: string | null;
  isSystem?: boolean;
  isTemplate?: boolean;
  isArchived?: boolean;
  permissionCount?: number;
  platformPermissionCount?: number;
}

export interface TenantSummary {
  exists: boolean;
  id?: string;
  key?: string;
  name?: string;
}

export interface InspectResult {
  tenant: TenantSummary;
  platformUser: UserSummary;
  clubAdminUser: UserSummary;
  legacyUser: UserSummary;
  superAdminRole: RoleSummary;
  tenantClubAdminRole: RoleSummary;
  duplicateEmailsFound: boolean;
  duplicateEmails: string[];
}

export interface DryRunPlan {
  usersToCreate: string[];
  usersToReuse: string[];
  authCredsToCreate: string[];
  membershipsToCreate: string[];
  rolesToCreate: string[];
  userRolesToCreate: string[];
  rolePermissionsToCreate: number;
  recordsToDelete: string[];
  legacyChanges: string[];
  noTenantForPlatform: boolean;
  noPlatformForTenant: boolean;
  noDeletionPlanned: boolean;
  noLegacyRoleRemoval: boolean;
  noCleanupPlanned: boolean;
  conflicts: string[];
}

export type SafeGateName =
  | "FC_ALLSCHWIL_TENANT_FOUND"
  | "TENANT_UNIQUE"
  | "SUPER_ADMIN_ROLE_FOUND"
  | "SUPER_ADMIN_SCOPE_PLATFORM"
  | "SUPER_ADMIN_NOT_TEMPLATE"
  | "TENANT_CLUB_ADMIN_ROLE_SCOPE"
  | "TENANT_CLUB_ADMIN_NO_PLATFORM_PERMS"
  | "PLATFORM_EMAIL_NOT_DUPLICATE"
  | "CLUB_ADMIN_EMAIL_NOT_DUPLICATE"
  | "LEGACY_EMAIL_EXISTS"
  | "NO_MIXED_SCOPE_PLANNED"
  | "PLATFORM_PASSWORD_AVAILABLE"
  | "CLUB_ADMIN_PASSWORD_AVAILABLE"
  | "ENVIRONMENT_NOT_PRODUCTION"
  | "EXECUTE_FLAG_SET"
  | "EXACT_CONFIRMATION_PROVIDED"
  | "CLUB_ADMIN_HAS_NO_PLATFORM_ROLE"
  | "PLATFORM_USER_HAS_NO_CONFLICTING_TENANT_ROLE"
  | "TRANSACTION_SUPPORTED"
  | "PERMISSION_CATALOGUE_UNAMBIGUOUS";

export type GateStatus = "PASS" | "FAIL" | "NOT_EVALUATED";

export interface SafeGateResult {
  gate: SafeGateName;
  status: GateStatus;
  detail: string;
}

// ---------------------------------------------------------------------------
// Environment detection helpers
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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  return errors;
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
// Read-only inspection helpers
// ---------------------------------------------------------------------------

export async function inspectUser(
  prisma: PrismaClient,
  email: string
): Promise<UserSummary> {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      userRoles: {
        include: {
          role: {
            select: {
              id: true,
              key: true,
              scope: true,
            },
          },
        },
      },
      tenantMemberships: {
        include: {
          tenant: {
            select: { id: true, key: true },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      exists: false,
      platformRoles: [],
      tenantMemberships: [],
      tenantRoles: [],
    };
  }

  const platformRoles = user.userRoles
    .filter((ur) => ur.role.scope === RoleScope.PLATFORM)
    .map((ur) => ({
      roleId: ur.role.id,
      roleKey: ur.role.key,
      userRoleTenantId: ur.tenantId ?? null,
    }));

  const tenantRoles = user.userRoles
    .filter((ur) => ur.role.scope === RoleScope.TENANT)
    .map((ur) => ({
      roleId: ur.role.id,
      roleKey: ur.role.key,
      userRoleTenantId: ur.tenantId ?? null,
    }));

  const tenantMemberships = user.tenantMemberships.map((tm) => ({
    tenantId: tm.tenantId,
    tenantKey: tm.tenant.key,
    isActive: tm.isActive,
  }));

  return {
    exists: true,
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    hasPasswordHash: Boolean(user.passwordHash),
    platformRoles,
    tenantMemberships,
    tenantRoles,
  };
}

export async function inspectRole(
  prisma: PrismaClient,
  roleKey: string
): Promise<RoleSummary> {
  const role = await prisma.role.findUnique({
    where: { key: roleKey },
    include: {
      rolePermissions: {
        include: {
          permission: {
            select: { scope: true },
          },
        },
      },
    },
  });

  if (!role) {
    return { exists: false };
  }

  const platformPermissionCount = role.rolePermissions.filter(
    (rp) => rp.permission.scope === PermissionScope.PLATFORM
  ).length;

  return {
    exists: true,
    id: role.id,
    key: role.key,
    name: role.name,
    scope: role.scope,
    tenantId: role.tenantId ?? null,
    isSystem: role.isSystem,
    isTemplate: role.isTemplate,
    isArchived: role.isArchived,
    permissionCount: role.rolePermissions.length,
    platformPermissionCount,
  };
}

export async function inspectTenant(
  prisma: PrismaClient,
  tenantKey: string
): Promise<TenantSummary> {
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantKey },
    select: { id: true, key: true, name: true },
  });

  if (!tenant) {
    return { exists: false };
  }

  return {
    exists: true,
    id: tenant.id,
    key: tenant.key,
    name: tenant.name,
  };
}

export async function checkDuplicateEmails(
  prisma: PrismaClient,
  emails: string[]
): Promise<{ duplicates: string[] }> {
  const normalizedEmails = emails.map(normalizeEmail);
  const duplicates: string[] = [];

  for (const email of normalizedEmails) {
    const count = await prisma.user.count({ where: { email } });
    if (count > 1) {
      duplicates.push(email);
    }
  }

  return { duplicates };
}

// ---------------------------------------------------------------------------
// Inspect mode
// ---------------------------------------------------------------------------

export async function runInspect(
  prisma: PrismaClient,
  options: {
    platformEmail?: string;
    clubAdminEmail?: string;
    legacyAdminEmail?: string;
    tenantKey?: string;
  } = {}
): Promise<InspectResult> {
  const platformEmail = options.platformEmail ?? PLATFORM_EMAIL;
  const clubAdminEmail = options.clubAdminEmail ?? CLUB_ADMIN_EMAIL;
  const legacyAdminEmail = options.legacyAdminEmail ?? LEGACY_EMAIL;
  const tenantKey = options.tenantKey ?? TENANT_KEY;

  const [tenant, platformUser, clubAdminUser, legacyUser, superAdminRole, tenantClubAdminRole] =
    await Promise.all([
      inspectTenant(prisma, tenantKey),
      inspectUser(prisma, platformEmail),
      inspectUser(prisma, clubAdminEmail),
      inspectUser(prisma, legacyAdminEmail),
      inspectRole(prisma, SUPER_ADMIN_ROLE_KEY),
      inspectRole(prisma, TENANT_CLUB_ADMIN_ROLE_KEY),
    ]);

  const { duplicates } = await checkDuplicateEmails(prisma, [
    platformEmail,
    clubAdminEmail,
    legacyAdminEmail,
  ]);

  return {
    tenant,
    platformUser,
    clubAdminUser,
    legacyUser,
    superAdminRole,
    tenantClubAdminRole,
    duplicateEmailsFound: duplicates.length > 0,
    duplicateEmails: duplicates,
  };
}

// ---------------------------------------------------------------------------
// Dry-run mode
// ---------------------------------------------------------------------------

export async function runDryRun(
  prisma: PrismaClient,
  options: {
    platformEmail?: string;
    clubAdminEmail?: string;
    legacyAdminEmail?: string;
    tenantKey?: string;
    platformPasswordAvailable?: boolean;
    clubAdminPasswordAvailable?: boolean;
  } = {}
): Promise<DryRunPlan> {
  const platformEmail = options.platformEmail ?? PLATFORM_EMAIL;
  const clubAdminEmail = options.clubAdminEmail ?? CLUB_ADMIN_EMAIL;
  const legacyAdminEmail = options.legacyAdminEmail ?? LEGACY_EMAIL;
  const tenantKey = options.tenantKey ?? TENANT_KEY;

  const inspect = await runInspect(prisma, {
    platformEmail,
    clubAdminEmail,
    legacyAdminEmail,
    tenantKey,
  });

  const plan: DryRunPlan = {
    usersToCreate: [],
    usersToReuse: [],
    authCredsToCreate: [],
    membershipsToCreate: [],
    rolesToCreate: [],
    userRolesToCreate: [],
    rolePermissionsToCreate: 0,
    recordsToDelete: [],
    legacyChanges: ["PRESERVE — no changes planned"],
    noTenantForPlatform: true,
    noPlatformForTenant: true,
    noDeletionPlanned: true,
    noLegacyRoleRemoval: true,
    noCleanupPlanned: true,
    conflicts: [],
  };

  // Platform user plan
  if (!inspect.platformUser.exists) {
    plan.usersToCreate.push(platformEmail);
    plan.authCredsToCreate.push(`${platformEmail} (source: env SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD)`);
  } else {
    plan.usersToReuse.push(platformEmail);
    if (!inspect.platformUser.hasPasswordHash) {
      plan.authCredsToCreate.push(`${platformEmail} (no password hash found)`);
    }
  }

  const hasSuperAdminRole = inspect.platformUser.platformRoles.some(
    (r) => r.roleKey === SUPER_ADMIN_ROLE_KEY
  );
  if (!hasSuperAdminRole) {
    plan.userRolesToCreate.push(
      `${platformEmail} → ${SUPER_ADMIN_ROLE_KEY} (scope=PLATFORM, UserRole.tenantId=null)`
    );
  }

  // Check for conflicting tenant roles on platform user
  if (inspect.platformUser.tenantRoles.length > 0) {
    plan.conflicts.push(
      `${platformEmail} already has tenant role(s): ${inspect.platformUser.tenantRoles.map((r) => r.roleKey).join(", ")}`
    );
  }
  if (inspect.platformUser.tenantMemberships.length > 0) {
    plan.conflicts.push(
      `${platformEmail} already has tenant membership(s): ${inspect.platformUser.tenantMemberships.map((m) => m.tenantKey).join(", ")}`
    );
  }

  // Club admin user plan
  if (!inspect.clubAdminUser.exists) {
    plan.usersToCreate.push(clubAdminEmail);
    plan.authCredsToCreate.push(`${clubAdminEmail} (source: env FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD)`);
  } else {
    plan.usersToReuse.push(clubAdminEmail);
    if (!inspect.clubAdminUser.hasPasswordHash) {
      plan.authCredsToCreate.push(`${clubAdminEmail} (no password hash found)`);
    }
  }

  // Check for conflicting platform roles on club admin
  if (inspect.clubAdminUser.platformRoles.length > 0) {
    plan.conflicts.push(
      `${clubAdminEmail} already has platform role(s): ${inspect.clubAdminUser.platformRoles.map((r) => r.roleKey).join(", ")}`
    );
  }

  const hasFcaMembership = inspect.clubAdminUser.tenantMemberships.some(
    (m) => m.tenantKey === tenantKey && m.isActive
  );
  if (!hasFcaMembership) {
    plan.membershipsToCreate.push(`${clubAdminEmail} → ${tenantKey} (active=true)`);
  }

  // Tenant Club Admin role plan
  if (!inspect.tenantClubAdminRole.exists) {
    plan.rolesToCreate.push(
      `${TENANT_CLUB_ADMIN_ROLE_KEY} (name="${TENANT_CLUB_ADMIN_ROLE_NAME}", scope=TENANT, tenantId=FC Allschwil tenant ID)`
    );
    plan.rolePermissionsToCreate = TENANT_PERMISSION_KEYS.length;
  } else {
    // Already exists — check for missing permissions
    const existingCount = inspect.tenantClubAdminRole.permissionCount ?? 0;
    const missing = TENANT_PERMISSION_KEYS.length - existingCount;
    if (missing > 0) {
      plan.rolePermissionsToCreate = missing;
    }
    // Check for platform permissions attached (must not exist)
    if ((inspect.tenantClubAdminRole.platformPermissionCount ?? 0) > 0) {
      plan.conflicts.push(
        `Tenant Club Admin role already has ${inspect.tenantClubAdminRole.platformPermissionCount} PLATFORM-scoped permission(s) attached — MANUAL REVIEW REQUIRED`
      );
    }
  }

  const hasTenantClubAdminRole = inspect.clubAdminUser.tenantRoles.some(
    (r) => r.roleKey === TENANT_CLUB_ADMIN_ROLE_KEY
  );
  if (!hasTenantClubAdminRole) {
    plan.userRolesToCreate.push(
      `${clubAdminEmail} → ${TENANT_CLUB_ADMIN_ROLE_KEY} (scope=TENANT, UserRole.tenantId=FC Allschwil tenant ID)`
    );
  }

  // Duplicate email check
  if (inspect.duplicateEmailsFound) {
    for (const dup of inspect.duplicateEmails) {
      plan.conflicts.push(`DUPLICATE EMAIL FOUND: ${dup} — MANUAL REVIEW REQUIRED`);
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Safety gates
// ---------------------------------------------------------------------------

export function evaluateSafetyGates(params: {
  inspect: InspectResult;
  isExecute: boolean;
  confirmValue: string | undefined;
  platformPasswordAvailable: boolean;
  clubAdminPasswordAvailable: boolean;
  connectionString: string | undefined;
}): SafeGateResult[] {
  const {
    inspect,
    isExecute,
    confirmValue,
    platformPasswordAvailable,
    clubAdminPasswordAvailable,
    connectionString,
  } = params;

  const gates: SafeGateResult[] = [];

  // Gate 1: FC Allschwil tenant found
  gates.push({
    gate: "FC_ALLSCHWIL_TENANT_FOUND",
    status: inspect.tenant.exists ? "PASS" : "FAIL",
    detail: inspect.tenant.exists
      ? `Tenant found: ${inspect.tenant.name} (id=${inspect.tenant.id})`
      : "fc-allschwil tenant not found — run db:seed first",
  });

  // Gate 2: Tenant uniqueness (already guaranteed by Prisma unique on key, but verify)
  gates.push({
    gate: "TENANT_UNIQUE",
    status: inspect.tenant.exists ? "PASS" : "NOT_EVALUATED",
    detail: inspect.tenant.exists ? "Tenant key is unique (Prisma @unique constraint)" : "Not evaluated",
  });

  // Gate 3: super_admin role found
  gates.push({
    gate: "SUPER_ADMIN_ROLE_FOUND",
    status: inspect.superAdminRole.exists ? "PASS" : "FAIL",
    detail: inspect.superAdminRole.exists
      ? `super_admin role found (id=${inspect.superAdminRole.id})`
      : "super_admin role not found — run db:seed first",
  });

  // Gate 4: super_admin scope is PLATFORM
  gates.push({
    gate: "SUPER_ADMIN_SCOPE_PLATFORM",
    status:
      inspect.superAdminRole.exists && inspect.superAdminRole.scope === RoleScope.PLATFORM
        ? "PASS"
        : inspect.superAdminRole.exists
        ? "FAIL"
        : "NOT_EVALUATED",
    detail: inspect.superAdminRole.exists
      ? `super_admin scope=${inspect.superAdminRole.scope}`
      : "Not evaluated",
  });

  // Gate 5: super_admin is not a template
  gates.push({
    gate: "SUPER_ADMIN_NOT_TEMPLATE",
    status:
      inspect.superAdminRole.exists && !inspect.superAdminRole.isTemplate
        ? "PASS"
        : inspect.superAdminRole.exists
        ? "FAIL"
        : "NOT_EVALUATED",
    detail: inspect.superAdminRole.exists
      ? `super_admin isTemplate=${inspect.superAdminRole.isTemplate}`
      : "Not evaluated",
  });

  // Gate 6: Tenant Club Admin role (if exists) must have scope=TENANT
  const tcaRoleExists = inspect.tenantClubAdminRole.exists;
  const tcaRoleScopeValid = !tcaRoleExists || inspect.tenantClubAdminRole.scope === RoleScope.TENANT;
  gates.push({
    gate: "TENANT_CLUB_ADMIN_ROLE_SCOPE",
    status: tcaRoleScopeValid ? "PASS" : "FAIL",
    detail: tcaRoleExists
      ? `Club Admin role scope=${inspect.tenantClubAdminRole.scope}`
      : "Club Admin role not yet created — will be created during execute",
  });

  // Gate 7: Tenant Club Admin role must have no PLATFORM permissions
  const platformPermCount = inspect.tenantClubAdminRole.platformPermissionCount ?? 0;
  gates.push({
    gate: "TENANT_CLUB_ADMIN_NO_PLATFORM_PERMS",
    status: platformPermCount === 0 ? "PASS" : "FAIL",
    detail:
      platformPermCount === 0
        ? "No PLATFORM-scoped permissions attached to Club Admin role"
        : `Club Admin role has ${platformPermCount} PLATFORM-scoped permission(s) — scope violation`,
  });

  // Gate 8: Platform email not duplicated
  const platformEmailDuplicated = inspect.duplicateEmails.includes(
    normalizeEmail(PLATFORM_EMAIL)
  );
  gates.push({
    gate: "PLATFORM_EMAIL_NOT_DUPLICATE",
    status: platformEmailDuplicated ? "FAIL" : "PASS",
    detail: platformEmailDuplicated
      ? `${PLATFORM_EMAIL} exists more than once — MANUAL REVIEW REQUIRED`
      : `${PLATFORM_EMAIL} appears at most once`,
  });

  // Gate 9: Club admin email not duplicated
  const clubEmailDuplicated = inspect.duplicateEmails.includes(
    normalizeEmail(CLUB_ADMIN_EMAIL)
  );
  gates.push({
    gate: "CLUB_ADMIN_EMAIL_NOT_DUPLICATE",
    status: clubEmailDuplicated ? "FAIL" : "PASS",
    detail: clubEmailDuplicated
      ? `${CLUB_ADMIN_EMAIL} exists more than once — MANUAL REVIEW REQUIRED`
      : `${CLUB_ADMIN_EMAIL} appears at most once`,
  });

  // Gate 10: Legacy email must exist (if we're in execute mode, warn if not)
  const legacyExists = inspect.legacyUser.exists;
  gates.push({
    gate: "LEGACY_EMAIL_EXISTS",
    status: legacyExists ? "PASS" : "FAIL",
    detail: legacyExists
      ? `${LEGACY_EMAIL} found — will be preserved unchanged`
      : `${LEGACY_EMAIL} not found — this is unexpected, verify before proceeding`,
  });

  // Gate 11: No mixed scope planned
  const noMixedScope =
    inspect.platformUser.tenantRoles.length === 0 &&
    inspect.clubAdminUser.platformRoles.length === 0;
  gates.push({
    gate: "NO_MIXED_SCOPE_PLANNED",
    status: noMixedScope ? "PASS" : "FAIL",
    detail: noMixedScope
      ? "No cross-scope role assignments detected"
      : `Mixed scope detected: platform user tenant roles=${inspect.platformUser.tenantRoles.length}, club admin platform roles=${inspect.clubAdminUser.platformRoles.length}`,
  });

  // Gate 12: Platform password available (only required if account needs creation or reset)
  const platformNeedsPassword =
    !inspect.platformUser.exists || !inspect.platformUser.hasPasswordHash;
  gates.push({
    gate: "PLATFORM_PASSWORD_AVAILABLE",
    status:
      !isExecute
        ? "NOT_EVALUATED"
        : platformNeedsPassword
        ? platformPasswordAvailable
          ? "PASS"
          : "FAIL"
        : "PASS",
    detail: isExecute
      ? platformNeedsPassword
        ? platformPasswordAvailable
          ? "SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD is set"
          : "SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD is required but not set"
        : "Existing account — password not required unless --reset-platform-password"
      : "Not evaluated in non-execute mode",
  });

  // Gate 13: Club admin password available
  const clubAdminNeedsPassword =
    !inspect.clubAdminUser.exists || !inspect.clubAdminUser.hasPasswordHash;
  gates.push({
    gate: "CLUB_ADMIN_PASSWORD_AVAILABLE",
    status:
      !isExecute
        ? "NOT_EVALUATED"
        : clubAdminNeedsPassword
        ? clubAdminPasswordAvailable
          ? "PASS"
          : "FAIL"
        : "PASS",
    detail: isExecute
      ? clubAdminNeedsPassword
        ? clubAdminPasswordAvailable
          ? "FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD is set"
          : "FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD is required but not set"
        : "Existing account — password not required unless --reset-club-admin-password"
      : "Not evaluated in non-execute mode",
  });

  // Gate 14: Environment is not production
  const env = detectEnvironment(connectionString);
  gates.push({
    gate: "ENVIRONMENT_NOT_PRODUCTION",
    status: env === "PROD" ? "FAIL" : "PASS",
    detail: `Detected environment: ${env}`,
  });

  // Gate 15: --execute flag
  gates.push({
    gate: "EXECUTE_FLAG_SET",
    status: isExecute ? "PASS" : "NOT_EVALUATED",
    detail: isExecute ? "--execute flag provided" : "Not an execute run — gate not applicable",
  });

  // Gate 16: Exact confirmation value
  gates.push({
    gate: "EXACT_CONFIRMATION_PROVIDED",
    status:
      !isExecute
        ? "NOT_EVALUATED"
        : confirmValue === EXECUTE_CONFIRMATION
        ? "PASS"
        : "FAIL",
    detail: isExecute
      ? confirmValue === EXECUTE_CONFIRMATION
        ? `Exact confirmation value matched: ${EXECUTE_CONFIRMATION}`
        : `Confirmation value missing or incorrect (expected: ${EXECUTE_CONFIRMATION})`
      : "Not evaluated in non-execute mode",
  });

  // Gate 17: Club admin has no platform role (if exists)
  const clubAdminHasPlatformRole = inspect.clubAdminUser.platformRoles.length > 0;
  gates.push({
    gate: "CLUB_ADMIN_HAS_NO_PLATFORM_ROLE",
    status: clubAdminHasPlatformRole ? "FAIL" : "PASS",
    detail: clubAdminHasPlatformRole
      ? `${CLUB_ADMIN_EMAIL} has platform role(s): ${inspect.clubAdminUser.platformRoles.map((r) => r.roleKey).join(", ")} — MANUAL REVIEW REQUIRED`
      : `${CLUB_ADMIN_EMAIL} has no platform roles (correct)`,
  });

  // Gate 18: Platform user has no conflicting tenant role
  const platformHasTenantRole = inspect.platformUser.tenantRoles.length > 0;
  gates.push({
    gate: "PLATFORM_USER_HAS_NO_CONFLICTING_TENANT_ROLE",
    status: platformHasTenantRole ? "FAIL" : "PASS",
    detail: platformHasTenantRole
      ? `${PLATFORM_EMAIL} has tenant role(s): ${inspect.platformUser.tenantRoles.map((r) => r.roleKey).join(", ")} — MANUAL REVIEW REQUIRED`
      : `${PLATFORM_EMAIL} has no tenant roles (correct)`,
  });

  // Gate 19: Transaction supported (always PASS for Postgres)
  gates.push({
    gate: "TRANSACTION_SUPPORTED",
    status: "PASS",
    detail: "PostgreSQL — transactions supported",
  });

  // Gate 20: Permission catalogue unambiguous (TENANT_PERMISSION_KEYS are deterministic)
  gates.push({
    gate: "PERMISSION_CATALOGUE_UNAMBIGUOUS",
    status: "PASS",
    detail: `${TENANT_PERMISSION_KEYS.length} TENANT-scoped canonical permissions defined`,
  });

  return gates;
}

// ---------------------------------------------------------------------------
// Execute mode
// ---------------------------------------------------------------------------

export interface ExecuteResult {
  success: boolean;
  platformUserId?: string;
  clubAdminUserId?: string;
  tenantClubAdminRoleId?: string;
  usersCreated: string[];
  usersReused: string[];
  membershipsCreated: string[];
  rolesCreated: string[];
  userRolesCreated: string[];
  rolePermissionsCreated: number;
  postconditions: Array<{ check: string; passed: boolean; detail: string }>;
  error?: string;
}

export async function runExecute(
  prisma: PrismaClient,
  options: {
    platformEmail?: string;
    clubAdminEmail?: string;
    legacyAdminEmail?: string;
    tenantKey?: string;
    platformPassword: string;
    clubAdminPassword: string;
    resetPlatformPassword?: boolean;
    resetClubAdminPassword?: boolean;
  }
): Promise<ExecuteResult> {
  const platformEmail = normalizeEmail(options.platformEmail ?? PLATFORM_EMAIL);
  const clubAdminEmail = normalizeEmail(options.clubAdminEmail ?? CLUB_ADMIN_EMAIL);
  const legacyAdminEmail = normalizeEmail(options.legacyAdminEmail ?? LEGACY_EMAIL);
  const tenantKey = options.tenantKey ?? TENANT_KEY;

  const result: ExecuteResult = {
    success: false,
    usersCreated: [],
    usersReused: [],
    membershipsCreated: [],
    rolesCreated: [],
    userRolesCreated: [],
    rolePermissionsCreated: 0,
    postconditions: [],
  };

  // Pre-hash passwords before transaction (async work)
  const platformPasswordHash = await hashPassword(options.platformPassword);
  const clubAdminPasswordHash = await hashPassword(options.clubAdminPassword);

  // Run everything in a single transaction
  await prisma.$transaction(async (tx) => {
    // Step 1: Verify FC Allschwil tenant
    const tenant = await tx.tenant.findUnique({
      where: { key: tenantKey },
      select: { id: true, key: true, name: true },
    });
    if (!tenant) {
      throw new Error(`FC Allschwil tenant (key=${tenantKey}) not found — run db:seed first`);
    }

    // Step 2: Verify super_admin role
    const superAdminRole = await tx.role.findUnique({
      where: { key: SUPER_ADMIN_ROLE_KEY },
      select: { id: true, scope: true, isTemplate: true, isArchived: true },
    });
    if (!superAdminRole) {
      throw new Error("super_admin role not found — run db:seed first");
    }
    if (superAdminRole.scope !== RoleScope.PLATFORM) {
      throw new Error(`super_admin role has unexpected scope: ${superAdminRole.scope}`);
    }
    if (superAdminRole.isTemplate) {
      throw new Error("super_admin role is marked as template — cannot assign");
    }

    // Step 3: Verify or create FC Allschwil tenant Club Admin role
    let tenantClubAdminRole = await tx.role.findUnique({
      where: { key: TENANT_CLUB_ADMIN_ROLE_KEY },
      select: { id: true, scope: true, tenantId: true, isArchived: true },
    });

    if (!tenantClubAdminRole) {
      tenantClubAdminRole = await tx.role.create({
        data: {
          key: TENANT_CLUB_ADMIN_ROLE_KEY,
          name: TENANT_CLUB_ADMIN_ROLE_NAME,
          description: "FC Allschwil tenant-scoped Club Administrator",
          scope: RoleScope.TENANT,
          tenantId: tenant.id,
          isSystem: false,
          isTemplate: false,
          isArchived: false,
        },
        select: { id: true, scope: true, tenantId: true, isArchived: true },
      });
      result.rolesCreated.push(TENANT_CLUB_ADMIN_ROLE_KEY);
    } else {
      if (tenantClubAdminRole.scope !== RoleScope.TENANT) {
        throw new Error(
          `Tenant Club Admin role has unexpected scope: ${tenantClubAdminRole.scope}`
        );
      }
      if (tenantClubAdminRole.tenantId !== tenant.id) {
        throw new Error(
          `Tenant Club Admin role is scoped to a different tenant (expected ${tenant.id}, got ${tenantClubAdminRole.tenantId})`
        );
      }
    }

    result.tenantClubAdminRoleId = tenantClubAdminRole.id;

    // Step 4: Assign TENANT-scoped permissions to Club Admin role
    for (const permKey of TENANT_PERMISSION_KEYS) {
      const permission = await tx.permission.findUnique({
        where: { key: permKey },
        select: { id: true, scope: true },
      });
      if (!permission) {
        throw new Error(`Canonical permission not found: ${permKey}`);
      }
      if (permission.scope !== PermissionScope.TENANT) {
        throw new Error(
          `Permission ${permKey} is not TENANT-scoped (scope=${permission.scope}) — cannot attach to Club Admin role`
        );
      }

      const existingRp = await tx.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: tenantClubAdminRole.id,
            permissionId: permission.id,
          },
        },
        select: { id: true },
      });

      if (!existingRp) {
        await tx.rolePermission.create({
          data: {
            roleId: tenantClubAdminRole.id,
            permissionId: permission.id,
          },
        });
        result.rolePermissionsCreated++;
      }
    }

    // Step 5: Verify or create hello@tulip-digital.ch
    let platformUser = await tx.user.findUnique({
      where: { email: platformEmail },
      select: { id: true, email: true, isActive: true, passwordHash: true },
    });

    if (!platformUser) {
      platformUser = await tx.user.create({
        data: {
          email: platformEmail,
          firstName: "SCE",
          lastName: "Super Admin",
          passwordHash: platformPasswordHash,
          isActive: true,
          tenantId: null,
        },
        select: { id: true, email: true, isActive: true, passwordHash: true },
      });
      result.usersCreated.push(platformEmail);
    } else {
      result.usersReused.push(platformEmail);
      if (options.resetPlatformPassword) {
        await tx.user.update({
          where: { id: platformUser.id },
          data: { passwordHash: platformPasswordHash },
        });
      }
      if (!platformUser.isActive) {
        throw new Error(`${platformEmail} exists but isActive=false — cannot assign roles`);
      }
    }

    result.platformUserId = platformUser.id;

    // Step 6: Assign super_admin role (platform, tenantId=null)
    const existingPlatformRole = await tx.userRole.findUnique({
      where: { userId_roleId: { userId: platformUser.id, roleId: superAdminRole.id } },
      select: { id: true, tenantId: true },
    });

    if (!existingPlatformRole) {
      await tx.userRole.create({
        data: {
          userId: platformUser.id,
          roleId: superAdminRole.id,
          tenantId: null,
        },
      });
      result.userRolesCreated.push(`${platformEmail} → ${SUPER_ADMIN_ROLE_KEY}`);
    }

    // Step 7: Verify platform account has no tenant role
    const platformTenantRoles = await tx.userRole.findMany({
      where: {
        userId: platformUser.id,
        role: { scope: RoleScope.TENANT },
      },
      include: { role: { select: { key: true } } },
    });
    if (platformTenantRoles.length > 0) {
      const keys = platformTenantRoles.map((ur) => ur.role.key).join(", ");
      throw new Error(
        `${platformEmail} has tenant role(s) assigned: ${keys} — MANUAL REVIEW REQUIRED before proceeding`
      );
    }

    // Step 8: Verify or create it@fcallschwil.ch
    let clubAdminUser = await tx.user.findUnique({
      where: { email: clubAdminEmail },
      select: { id: true, email: true, isActive: true, passwordHash: true },
    });

    if (!clubAdminUser) {
      clubAdminUser = await tx.user.create({
        data: {
          email: clubAdminEmail,
          firstName: "FC Allschwil",
          lastName: "Club Admin",
          passwordHash: clubAdminPasswordHash,
          isActive: true,
          tenantId: tenant.id,
        },
        select: { id: true, email: true, isActive: true, passwordHash: true },
      });
      result.usersCreated.push(clubAdminEmail);
    } else {
      result.usersReused.push(clubAdminEmail);
      if (options.resetClubAdminPassword) {
        await tx.user.update({
          where: { id: clubAdminUser.id },
          data: { passwordHash: clubAdminPasswordHash },
        });
      }
      if (!clubAdminUser.isActive) {
        throw new Error(`${clubAdminEmail} exists but isActive=false — cannot assign roles`);
      }
    }

    result.clubAdminUserId = clubAdminUser.id;

    // Step 9: Create or activate FC Allschwil TenantMembership
    const existingMembership = await tx.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: clubAdminUser.id } },
      select: { id: true, isActive: true },
    });

    if (!existingMembership) {
      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: clubAdminUser.id,
          isActive: true,
        },
      });
      result.membershipsCreated.push(`${clubAdminEmail} → ${tenantKey}`);
    } else if (!existingMembership.isActive) {
      await tx.tenantMembership.update({
        where: { tenantId_userId: { tenantId: tenant.id, userId: clubAdminUser.id } },
        data: { isActive: true },
      });
      result.membershipsCreated.push(`${clubAdminEmail} → ${tenantKey} (reactivated)`);
    }

    // Step 10: Assign tenant Club Admin role
    const existingClubAdminRole = await tx.userRole.findUnique({
      where: {
        userId_roleId: { userId: clubAdminUser.id, roleId: tenantClubAdminRole.id },
      },
      select: { id: true, tenantId: true },
    });

    if (!existingClubAdminRole) {
      await tx.userRole.create({
        data: {
          userId: clubAdminUser.id,
          roleId: tenantClubAdminRole.id,
          tenantId: tenant.id,
        },
      });
      result.userRolesCreated.push(`${clubAdminEmail} → ${TENANT_CLUB_ADMIN_ROLE_KEY}`);
    }

    // Step 11: Verify club admin has no platform role
    const clubAdminPlatformRoles = await tx.userRole.findMany({
      where: {
        userId: clubAdminUser.id,
        role: { scope: RoleScope.PLATFORM },
      },
      include: { role: { select: { key: true } } },
    });
    if (clubAdminPlatformRoles.length > 0) {
      const keys = clubAdminPlatformRoles.map((ur) => ur.role.key).join(", ");
      throw new Error(
        `${clubAdminEmail} has platform role(s) assigned: ${keys} — MANUAL REVIEW REQUIRED before proceeding`
      );
    }

    // Step 12: Preserve legacy account (read-only verify)
    const legacyUser = await tx.user.findUnique({
      where: { email: legacyAdminEmail },
      select: { id: true, isActive: true },
    });
    if (!legacyUser) {
      throw new Error(
        `Legacy account ${legacyAdminEmail} not found — this is unexpected. Aborting to prevent data loss.`
      );
    }

    // ── Postconditions ────────────────────────────────────────────────────────

    // Postcondition 1: Platform user exists exactly once
    const platformUserCount = await tx.user.count({ where: { email: platformEmail } });
    result.postconditions.push({
      check: `${platformEmail} exists exactly once`,
      passed: platformUserCount === 1,
      detail: `count=${platformUserCount}`,
    });

    // Postcondition 2: Platform user is active
    const platformUserActive = await tx.user.findUnique({
      where: { email: platformEmail },
      select: { isActive: true },
    });
    result.postconditions.push({
      check: `${platformEmail} isActive`,
      passed: Boolean(platformUserActive?.isActive),
      detail: `isActive=${platformUserActive?.isActive}`,
    });

    // Postcondition 3: Platform user has super_admin assignment
    const platformSuperAdminAssignment = await tx.userRole.findUnique({
      where: { userId_roleId: { userId: platformUser.id, roleId: superAdminRole.id } },
      select: { id: true, tenantId: true },
    });
    result.postconditions.push({
      check: `${platformEmail} has super_admin UserRole`,
      passed: Boolean(platformSuperAdminAssignment),
      detail: platformSuperAdminAssignment
        ? `UserRole.tenantId=${platformSuperAdminAssignment.tenantId ?? "null"}`
        : "Missing",
    });

    result.postconditions.push({
      check: `${platformEmail} super_admin UserRole.tenantId=null`,
      passed: platformSuperAdminAssignment?.tenantId === null,
      detail: `tenantId=${platformSuperAdminAssignment?.tenantId ?? "missing"}`,
    });

    // Postcondition 4: Platform user has no tenant membership (created by this task)
    result.postconditions.push({
      check: `${platformEmail} no tenant membership created by this task`,
      passed: result.membershipsCreated.every((m) => !m.startsWith(platformEmail)),
      detail: "No TenantMembership created for platform account",
    });

    // Postcondition 5: Club admin user exists exactly once
    const clubAdminUserCount = await tx.user.count({ where: { email: clubAdminEmail } });
    result.postconditions.push({
      check: `${clubAdminEmail} exists exactly once`,
      passed: clubAdminUserCount === 1,
      detail: `count=${clubAdminUserCount}`,
    });

    // Postcondition 6: Club admin is active
    const clubAdminUserActive = await tx.user.findUnique({
      where: { email: clubAdminEmail },
      select: { isActive: true },
    });
    result.postconditions.push({
      check: `${clubAdminEmail} isActive`,
      passed: Boolean(clubAdminUserActive?.isActive),
      detail: `isActive=${clubAdminUserActive?.isActive}`,
    });

    // Postcondition 7: Club admin has active FCA membership
    const clubAdminMembership = await tx.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: clubAdminUser.id } },
      select: { isActive: true },
    });
    result.postconditions.push({
      check: `${clubAdminEmail} has active FC Allschwil TenantMembership`,
      passed: Boolean(clubAdminMembership?.isActive),
      detail: clubAdminMembership
        ? `TenantMembership.isActive=${clubAdminMembership.isActive}`
        : "Missing",
    });

    // Postcondition 8: Club admin has tenant Club Admin role
    const clubAdminRoleAssignment = await tx.userRole.findUnique({
      where: {
        userId_roleId: { userId: clubAdminUser.id, roleId: tenantClubAdminRole.id },
      },
      select: { id: true, tenantId: true },
    });
    result.postconditions.push({
      check: `${clubAdminEmail} has ${TENANT_CLUB_ADMIN_ROLE_KEY} UserRole`,
      passed: Boolean(clubAdminRoleAssignment),
      detail: clubAdminRoleAssignment
        ? `UserRole.tenantId=${clubAdminRoleAssignment.tenantId ?? "null"}`
        : "Missing",
    });

    result.postconditions.push({
      check: `${clubAdminEmail} Club Admin UserRole.tenantId=FC Allschwil tenant ID`,
      passed: clubAdminRoleAssignment?.tenantId === tenant.id,
      detail: `tenantId=${clubAdminRoleAssignment?.tenantId ?? "missing"} (expected=${tenant.id})`,
    });

    // Postcondition 9: Club admin has no platform roles
    const clubAdminPlatformRolesFinal = await tx.userRole.count({
      where: {
        userId: clubAdminUser.id,
        role: { scope: RoleScope.PLATFORM },
      },
    });
    result.postconditions.push({
      check: `${clubAdminEmail} has no platform roles`,
      passed: clubAdminPlatformRolesFinal === 0,
      detail: `platform role count=${clubAdminPlatformRolesFinal}`,
    });

    // Postcondition 10: Tenant Club Admin role scope is TENANT
    const tcaRoleFinal = await tx.role.findUnique({
      where: { key: TENANT_CLUB_ADMIN_ROLE_KEY },
      select: { scope: true, tenantId: true },
    });
    result.postconditions.push({
      check: `${TENANT_CLUB_ADMIN_ROLE_KEY} scope=TENANT`,
      passed: tcaRoleFinal?.scope === RoleScope.TENANT,
      detail: `scope=${tcaRoleFinal?.scope ?? "missing"}`,
    });

    result.postconditions.push({
      check: `${TENANT_CLUB_ADMIN_ROLE_KEY} tenantId=FC Allschwil tenant ID`,
      passed: tcaRoleFinal?.tenantId === tenant.id,
      detail: `tenantId=${tcaRoleFinal?.tenantId ?? "null"} (expected=${tenant.id})`,
    });

    // Postcondition 11: No PLATFORM permissions attached to Club Admin role
    const platformPermsOnClubAdmin = await tx.rolePermission.count({
      where: {
        roleId: tenantClubAdminRole.id,
        permission: { scope: PermissionScope.PLATFORM },
      },
    });
    result.postconditions.push({
      check: "No PLATFORM permissions attached to Club Admin role",
      passed: platformPermsOnClubAdmin === 0,
      detail: `platform permission count=${platformPermsOnClubAdmin}`,
    });

    // Postcondition 12: Legacy account preserved
    const legacyPreserved = await tx.user.findUnique({
      where: { email: legacyAdminEmail },
      select: { isActive: true },
    });
    result.postconditions.push({
      check: `${legacyAdminEmail} still exists and was not changed by this script`,
      passed: Boolean(legacyPreserved),
      detail: legacyPreserved
        ? `isActive=${legacyPreserved.isActive}`
        : "NOT FOUND — critical error",
    });

    // Check all postconditions — rollback if any fail
    const failedPostconditions = result.postconditions.filter((pc) => !pc.passed);
    if (failedPostconditions.length > 0) {
      const details = failedPostconditions.map((pc) => `  FAILED: ${pc.check} (${pc.detail})`).join("\n");
      throw new Error(
        `Postcondition failure — rolling back transaction:\n${details}`
      );
    }
  });

  result.success = true;
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  inspect: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
  platformEmail: string;
  clubAdminEmail: string;
  legacyAdminEmail: string;
  tenantKey: string;
  resetPlatformPassword: boolean;
  resetClubAdminPassword: boolean;
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
    platformEmail: get("--platform-email") ?? PLATFORM_EMAIL,
    clubAdminEmail: get("--club-admin-email") ?? CLUB_ADMIN_EMAIL,
    legacyAdminEmail: get("--legacy-admin-email") ?? LEGACY_EMAIL,
    tenantKey: get("--tenant-key") ?? TENANT_KEY,
    resetPlatformPassword: has("--reset-platform-password"),
    resetClubAdminPassword: has("--reset-club-admin-password"),
  };
}

function printInspectResult(result: InspectResult, platformEmail: string, clubAdminEmail: string, legacyAdminEmail: string): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RPERM-03B — Inspect Mode");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("── TENANT ──────────────────────────────────────────────");
  if (result.tenant.exists) {
    console.log(`  FC Allschwil tenant found : YES`);
    console.log(`  Tenant ID                 : ${result.tenant.id}`);
    console.log(`  Tenant key                : ${result.tenant.key}`);
    console.log(`  Tenant name               : ${result.tenant.name}`);
  } else {
    console.log("  FC Allschwil tenant found : NO — run db:seed first");
  }

  console.log("\n── PLATFORM ACCOUNT (" + platformEmail + ") ──");
  printUserSummary(result.platformUser);

  console.log("\n── FC ALLSCHWIL ACCOUNT (" + clubAdminEmail + ") ──");
  printUserSummary(result.clubAdminUser);

  console.log("\n── LEGACY ACCOUNT (" + legacyAdminEmail + ") ──");
  printUserSummary(result.legacyUser);

  console.log("\n── ROLES ───────────────────────────────────────────────");
  console.log(`  super_admin role exists   : ${result.superAdminRole.exists}`);
  if (result.superAdminRole.exists) {
    console.log(`  super_admin scope         : ${result.superAdminRole.scope}`);
    console.log(`  super_admin tenantId      : ${result.superAdminRole.tenantId ?? "null (correct)"}`);
  }

  console.log(`\n  ${TENANT_CLUB_ADMIN_ROLE_KEY} exists : ${result.tenantClubAdminRole.exists}`);
  if (result.tenantClubAdminRole.exists) {
    console.log(`  Tenant role scope         : ${result.tenantClubAdminRole.scope}`);
    console.log(`  Tenant role tenantId      : ${result.tenantClubAdminRole.tenantId}`);
    console.log(`  Tenant role permissions   : ${result.tenantClubAdminRole.permissionCount}`);
    console.log(`  Platform perms attached   : ${result.tenantClubAdminRole.platformPermissionCount} (must be 0)`);
  }

  console.log("\n── DUPLICATE EMAIL CHECK ────────────────────────────────");
  if (result.duplicateEmailsFound) {
    console.log("  DUPLICATE EMAILS FOUND — MANUAL REVIEW REQUIRED:");
    for (const dup of result.duplicateEmails) {
      console.log(`    ⚠  ${dup}`);
    }
  } else {
    console.log("  No duplicate emails found.");
  }

  console.log("");
}

function printUserSummary(user: UserSummary): void {
  if (!user.exists) {
    console.log("  Exists        : NO");
    return;
  }
  console.log(`  Exists        : YES`);
  console.log(`  User ID       : ${user.id}`);
  console.log(`  Active        : ${user.isActive}`);
  console.log(`  Has password  : ${user.hasPasswordHash} (hash NOT printed)`);
  console.log(`  Platform roles: ${user.platformRoles.length === 0 ? "none" : user.platformRoles.map((r) => r.roleKey).join(", ")}`);
  console.log(`  Tenant memberships: ${user.tenantMemberships.length === 0 ? "none" : user.tenantMemberships.map((m) => `${m.tenantKey}(active=${m.isActive})`).join(", ")}`);
  console.log(`  Tenant roles  : ${user.tenantRoles.length === 0 ? "none" : user.tenantRoles.map((r) => r.roleKey).join(", ")}`);
}

function printDryRunPlan(plan: DryRunPlan, platformEmail: string, clubAdminEmail: string, legacyAdminEmail: string): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RPERM-03B — Dry-Run Mode (zero DB writes)");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("── PLATFORM ACCOUNT ─────────────────────────────────────");
  for (const u of plan.usersToCreate) {
    if (u === platformEmail) console.log(`  CREATE USER: ${u}`);
  }
  for (const u of plan.usersToReuse) {
    if (u === platformEmail) console.log(`  REUSE USER: ${u}`);
  }
  for (const c of plan.authCredsToCreate) {
    if (c.includes(platformEmail)) {
      console.log(`  CREATE AUTH CREDENTIAL: ${c}`);
      console.log("    Plaintext logged: no");
    }
  }
  for (const ur of plan.userRolesToCreate) {
    if (ur.includes(platformEmail)) console.log(`  ASSIGN PLATFORM ROLE: ${ur}`);
  }
  console.log(`  No tenant assignment planned for ${platformEmail}: ${plan.noTenantForPlatform}`);

  console.log("\n── FC ALLSCHWIL CLUB ADMIN ──────────────────────────────");
  for (const u of plan.usersToCreate) {
    if (u === clubAdminEmail) console.log(`  CREATE USER: ${u}`);
  }
  for (const u of plan.usersToReuse) {
    if (u === clubAdminEmail) console.log(`  REUSE USER: ${u}`);
  }
  for (const c of plan.authCredsToCreate) {
    if (c.includes(clubAdminEmail)) {
      console.log(`  CREATE AUTH CREDENTIAL: ${c}`);
      console.log("    Plaintext logged: no");
    }
  }
  for (const m of plan.membershipsToCreate) {
    console.log(`  CREATE TENANT MEMBERSHIP: ${m}`);
  }
  for (const r of plan.rolesToCreate) {
    console.log(`  CREATE TENANT ROLE: ${r}`);
    console.log(`    TENANT-scoped permissions: ${TENANT_PERMISSION_KEYS.length}`);
  }
  if (plan.rolePermissionsToCreate > 0 && plan.rolesToCreate.length === 0) {
    console.log(`  ADD ROLE PERMISSIONS: ${plan.rolePermissionsToCreate} missing permissions`);
  }
  for (const ur of plan.userRolesToCreate) {
    if (ur.includes(clubAdminEmail)) console.log(`  ASSIGN TENANT ROLE: ${ur}`);
  }
  console.log(`  No platform assignment planned for ${clubAdminEmail}: ${plan.noPlatformForTenant}`);

  console.log("\n── LEGACY ACCOUNT ───────────────────────────────────────");
  for (const change of plan.legacyChanges) {
    console.log(`  ${legacyAdminEmail}: ${change}`);
  }

  console.log("\n── SAFETY SUMMARY ───────────────────────────────────────");
  console.log(`  No deletion planned           : ${plan.noDeletionPlanned}`);
  console.log(`  No legacy role removal planned: ${plan.noLegacyRoleRemoval}`);
  console.log(`  No cleanup planned            : ${plan.noCleanupPlanned}`);

  if (plan.conflicts.length > 0) {
    console.log("\n⚠  CONFLICTS DETECTED:");
    for (const c of plan.conflicts) {
      console.log(`  ⚠  ${c}`);
    }
  } else {
    console.log("\n  No conflicts detected.");
  }

  console.log("");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  // Default to inspect if no mode specified
  if (!opts.inspect && !opts.dryRun && !opts.execute) {
    console.error(
      "[rperm-03b] ERROR: No mode specified. Use --inspect, --dry-run, or --execute."
    );
    process.exit(1);
  }

  // Enforce --execute + --confirm requirement before touching DB
  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(
      `[rperm-03b] REFUSED: --execute requires:\n` +
      `  --confirm ${EXECUTE_CONFIRMATION}\n\n` +
      `Exact confirmation value not provided or incorrect.`
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[rperm-03b] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error(
      "[rperm-03b] BLOCKED: DATABASE_URL appears to point to a PRODUCTION database.\n" +
      "This script must only run against STAGE or LOCAL environments."
    );
    process.exit(1);
  }

  console.log(`[rperm-03b] Database: ${maskUrl(connectionString)}`);
  console.log(`[rperm-03b] Detected environment: ${env}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    if (opts.inspect) {
      const result = await runInspect(prisma, {
        platformEmail: opts.platformEmail,
        clubAdminEmail: opts.clubAdminEmail,
        legacyAdminEmail: opts.legacyAdminEmail,
        tenantKey: opts.tenantKey,
      });
      printInspectResult(result, opts.platformEmail, opts.clubAdminEmail, opts.legacyAdminEmail);
    }

    if (opts.dryRun) {
      const plan = await runDryRun(prisma, {
        platformEmail: opts.platformEmail,
        clubAdminEmail: opts.clubAdminEmail,
        legacyAdminEmail: opts.legacyAdminEmail,
        tenantKey: opts.tenantKey,
        platformPasswordAvailable: Boolean(process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD),
        clubAdminPasswordAvailable: Boolean(process.env.FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD),
      });
      printDryRunPlan(plan, opts.platformEmail, opts.clubAdminEmail, opts.legacyAdminEmail);
    }

    if (opts.execute) {
      // Re-verify confirmation (already checked above, but belt-and-suspenders)
      if (opts.confirm !== EXECUTE_CONFIRMATION) {
        throw new Error("Internal error: confirmation check bypassed");
      }

      const platformPassword = process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD;
      const clubAdminPassword = process.env.FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD;

      // Run inspect first for safety gates
      const inspect = await runInspect(prisma, {
        platformEmail: opts.platformEmail,
        clubAdminEmail: opts.clubAdminEmail,
        legacyAdminEmail: opts.legacyAdminEmail,
        tenantKey: opts.tenantKey,
      });

      const gates = evaluateSafetyGates({
        inspect,
        isExecute: true,
        confirmValue: opts.confirm,
        platformPasswordAvailable: Boolean(platformPassword),
        clubAdminPasswordAvailable: Boolean(clubAdminPassword),
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
        console.error("\n[rperm-03b] BLOCKED: One or more safety gates failed. Aborting.");
        process.exit(1);
      }

      if (!platformPassword) {
        console.error("[rperm-03b] ERROR: SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD is not set.");
        process.exit(1);
      }

      if (!clubAdminPassword) {
        console.error("[rperm-03b] ERROR: FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD is not set.");
        process.exit(1);
      }

      const platformPasswordErrors = validatePassword(platformPassword);
      const clubAdminPasswordErrors = validatePassword(clubAdminPassword);

      if (platformPasswordErrors.length > 0) {
        console.error("[rperm-03b] ERROR: SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD validation failed:");
        for (const err of platformPasswordErrors) console.error(`  - ${err}`);
        process.exit(1);
      }

      if (clubAdminPasswordErrors.length > 0) {
        console.error("[rperm-03b] ERROR: FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD validation failed:");
        for (const err of clubAdminPasswordErrors) console.error(`  - ${err}`);
        process.exit(1);
      }

      console.log("\n[rperm-03b] Executing bootstrap within a transaction...\n");

      const execResult = await runExecute(prisma, {
        platformEmail: opts.platformEmail,
        clubAdminEmail: opts.clubAdminEmail,
        legacyAdminEmail: opts.legacyAdminEmail,
        tenantKey: opts.tenantKey,
        platformPassword,
        clubAdminPassword,
        resetPlatformPassword: opts.resetPlatformPassword,
        resetClubAdminPassword: opts.resetClubAdminPassword,
      });

      console.log("── EXECUTION RESULT ─────────────────────────────────────");
      console.log(`  Users created          : ${execResult.usersCreated.join(", ") || "none"}`);
      console.log(`  Users reused           : ${execResult.usersReused.join(", ") || "none"}`);
      console.log(`  Memberships created    : ${execResult.membershipsCreated.join(", ") || "none"}`);
      console.log(`  Roles created          : ${execResult.rolesCreated.join(", ") || "none"}`);
      console.log(`  UserRoles created      : ${execResult.userRolesCreated.join(", ") || "none"}`);
      console.log(`  RolePermissions created: ${execResult.rolePermissionsCreated}`);

      console.log("\n── POSTCONDITIONS ───────────────────────────────────────");
      for (const pc of execResult.postconditions) {
        const symbol = pc.passed ? "✓" : "✗";
        console.log(`  [${pc.passed ? "PASS" : "FAIL"}] ${symbol} ${pc.check} (${pc.detail})`);
      }

      const allPassed = execResult.postconditions.every((pc) => pc.passed);
      if (!allPassed) {
        console.error("\n[rperm-03b] CRITICAL: Postcondition failures detected — transaction was rolled back.");
        process.exit(1);
      }

      console.log("\n[rperm-03b] Bootstrap complete. Transaction committed successfully.");
      console.log("Change passwords immediately after first login.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main when invoked directly (not when imported by tests)
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((err) => {
    console.error("[rperm-03b] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
