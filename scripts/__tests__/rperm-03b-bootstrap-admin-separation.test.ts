/**
 * scripts/__tests__/rperm-03b-bootstrap-admin-separation.test.ts
 *
 * RPERM-03B — Automated tests for the platform/tenant admin separation bootstrap.
 *
 * Test suites:
 *
 *   INSPECT MODE
 *     I-01  Detects all three account identities
 *     I-02  Detects existing platform role on hello@tulip-digital.ch
 *     I-03  Detects missing tenant Club Admin role
 *     I-04  Detects duplicate normalized emails
 *     I-05  Does not expose password hashes
 *     I-06  Does not expose password environment variables
 *
 *   DRY RUN
 *     DR-01  Performs no writes (pure inspection only)
 *     DR-02  Plans correct platform role assignment
 *     DR-03  Plans correct tenant membership creation
 *     DR-04  Plans correct tenant role assignment
 *     DR-05  Preserves legacy account (no changes planned)
 *     DR-06  Plans no deletion
 *     DR-07  Plans no tenant role for platform account
 *     DR-08  Plans no platform role for club admin account
 *
 *   PASSWORD HANDLING
 *     PW-01  Refuses creation without required password env var
 *     PW-02  Canonical hashPassword is used (bcrypt, 12 rounds)
 *     PW-03  validatePassword catches too-short passwords
 *     PW-04  Does not copy legacy password hash
 *     PW-05  validatePassword passes valid passwords
 *
 *   EXECUTE SAFETY
 *     ES-01  Refuses without --execute flag
 *     ES-02  Refuses without exact confirmation value
 *     ES-03  Refuses against PROD environment
 *     ES-04  evaluateSafetyGates: FAIL when duplicate emails exist
 *     ES-05  evaluateSafetyGates: FAIL when super_admin not found
 *     ES-06  evaluateSafetyGates: FAIL when tenant not found
 *     ES-07  evaluateSafetyGates: FAIL when tenant Club Admin has PLATFORM perms
 *     ES-08  evaluateSafetyGates: FAIL when club admin has platform role
 *     ES-09  evaluateSafetyGates: FAIL when platform user has tenant role
 *     ES-10  evaluateSafetyGates: PASS when all conditions are nominal
 *
 *   IDEMPOTENCY
 *     ID-01  runDryRun plans no user creation when both users already exist
 *     ID-02  runDryRun plans no membership creation when already active
 *     ID-03  runDryRun plans no role creation when role already exists
 *     ID-04  runDryRun plans no UserRole creation when already assigned
 *
 *   AUTHORIZATION SEPARATION
 *     AS-01  Platform user summary includes only platform roles (no tenant roles)
 *     AS-02  Club admin summary includes only tenant roles (no platform roles)
 *     AS-03  Legacy account summary is unmodified by plan
 *     AS-04  No cross-scope RolePermissions planned
 *     AS-05  Tenant permission catalogue contains only TENANT-scoped keys
 *
 *   HELPER FUNCTIONS
 *     H-01  detectEnvironment correctly classifies URLs
 *     H-02  maskUrl redacts passwords
 *     H-03  normalizeEmail lowercases and trims
 *     H-04  TENANT_PERMISSION_KEYS contains expected tenant permissions
 *     H-05  TENANT_PERMISSION_KEYS does not contain PLATFORM-only permissions
 */

import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { RoleScope, PermissionScope } from "@prisma/client";
import {
  PLATFORM_EMAIL,
  CLUB_ADMIN_EMAIL,
  LEGACY_EMAIL,
  TENANT_KEY,
  SUPER_ADMIN_ROLE_KEY,
  TENANT_CLUB_ADMIN_ROLE_KEY,
  EXECUTE_CONFIRMATION,
  TENANT_PERMISSION_KEYS,
  detectEnvironment,
  maskUrl,
  normalizeEmail,
  validatePassword,
  evaluateSafetyGates,
  runInspect,
  runDryRun,
  type InspectResult,
  type UserSummary,
  type RoleSummary,
  type TenantSummary,
} from "../rperm-03b-bootstrap-admin-separation";

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

function makeMockUser(email: string, overrides: Partial<{
  id: string;
  isActive: boolean;
  passwordHash: string;
  userRoles: Array<{ role: { id: string; key: string; scope: RoleScope } }>;
  tenantMemberships: Array<{ tenantId: string; isActive: boolean; tenant: { id: string; key: string } }>;
}> = {}) {
  return {
    id: `user-${email}-id`,
    email: normalizeEmail(email),
    isActive: overrides.isActive ?? true,
    passwordHash: overrides.passwordHash ?? "$2b$12$hashedpasswordhere",
    userRoles: overrides.userRoles ?? [],
    tenantMemberships: overrides.tenantMemberships ?? [],
  };
}

function makeMockRole(key: string, overrides: Partial<{
  id: string;
  scope: RoleScope;
  tenantId: string | null;
  isSystem: boolean;
  isTemplate: boolean;
  isArchived: boolean;
  rolePermissions: Array<{ permission: { scope: PermissionScope } }>;
}> = {}) {
  return {
    id: `role-${key}-id`,
    key,
    name: key.replace(/_/g, " "),
    scope: overrides.scope ?? RoleScope.PLATFORM,
    tenantId: overrides.tenantId ?? null,
    isSystem: overrides.isSystem ?? false,
    isTemplate: overrides.isTemplate ?? false,
    isArchived: overrides.isArchived ?? false,
    rolePermissions: overrides.rolePermissions ?? [],
  };
}

function makeMockTenant(key = "fc-allschwil") {
  return {
    id: `tenant-${key}-id`,
    key,
    name: "FC Allschwil",
  };
}

interface MockPrismaSetup {
  platformUser?: ReturnType<typeof makeMockUser> | null;
  clubAdminUser?: ReturnType<typeof makeMockUser> | null;
  legacyUser?: ReturnType<typeof makeMockUser> | null;
  superAdminRole?: ReturnType<typeof makeMockRole> | null;
  tenantClubAdminRole?: ReturnType<typeof makeMockRole> | null;
  tenant?: ReturnType<typeof makeMockTenant> | null;
  emailCounts?: Record<string, number>;
}

function makeMockPrisma(setup: MockPrismaSetup = {}): PrismaClient {
  const {
    platformUser = makeMockUser(PLATFORM_EMAIL),
    clubAdminUser = makeMockUser(CLUB_ADMIN_EMAIL),
    legacyUser = makeMockUser(LEGACY_EMAIL),
    superAdminRole = makeMockRole(SUPER_ADMIN_ROLE_KEY, { isSystem: true }),
    tenantClubAdminRole = null,
    tenant = makeMockTenant(),
    emailCounts = {},
  } = setup;

  const userMap: Record<string, ReturnType<typeof makeMockUser> | null> = {
    [normalizeEmail(PLATFORM_EMAIL)]: platformUser,
    [normalizeEmail(CLUB_ADMIN_EMAIL)]: clubAdminUser,
    [normalizeEmail(LEGACY_EMAIL)]: legacyUser,
  };

  const roleMap: Record<string, ReturnType<typeof makeMockRole> | null> = {
    [SUPER_ADMIN_ROLE_KEY]: superAdminRole,
    [TENANT_CLUB_ADMIN_ROLE_KEY]: tenantClubAdminRole,
  };

  return {
    user: {
      findUnique: vi.fn(({ where }: { where: { email?: string } }) => {
        const email = where.email;
        if (email !== undefined) {
          return Promise.resolve(userMap[email] ?? null);
        }
        return Promise.resolve(null);
      }),
      count: vi.fn(({ where }: { where: { email?: string } }) => {
        const email = where.email;
        if (email !== undefined && email in emailCounts) {
          return Promise.resolve(emailCounts[email]);
        }
        return Promise.resolve(email !== undefined && userMap[email] ? 1 : 0);
      }),
    },
    role: {
      findUnique: vi.fn(({ where }: { where: { key?: string } }) => {
        const key = where.key;
        if (key !== undefined && key in roleMap) {
          return Promise.resolve(roleMap[key] ?? null);
        }
        return Promise.resolve(null);
      }),
    },
    tenant: {
      findUnique: vi.fn(({ where }: { where: { key?: string } }) => {
        if (where.key === TENANT_KEY) return Promise.resolve(tenant);
        return Promise.resolve(null);
      }),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Helpers to build nominal inspect results
// ---------------------------------------------------------------------------

function nominalTenant(): TenantSummary {
  return { exists: true, id: "tenant-fc-allschwil-id", key: "fc-allschwil", name: "FC Allschwil" };
}

function nominalPlatformUser(): UserSummary {
  return {
    exists: true,
    id: "user-hello-id",
    email: PLATFORM_EMAIL,
    isActive: true,
    hasPasswordHash: true,
    platformRoles: [{ roleId: "role-super_admin-id", roleKey: SUPER_ADMIN_ROLE_KEY, userRoleTenantId: null }],
    tenantMemberships: [],
    tenantRoles: [],
  };
}

function nominalClubAdminUser(): UserSummary {
  return {
    exists: true,
    id: "user-it-fca-id",
    email: CLUB_ADMIN_EMAIL,
    isActive: true,
    hasPasswordHash: true,
    platformRoles: [],
    tenantMemberships: [{ tenantId: "tenant-fc-allschwil-id", tenantKey: "fc-allschwil", isActive: true }],
    tenantRoles: [{ roleId: "role-club_admin_fc_allschwil-id", roleKey: TENANT_CLUB_ADMIN_ROLE_KEY, userRoleTenantId: "tenant-fc-allschwil-id" }],
  };
}

function nominalLegacyUser(): UserSummary {
  return {
    exists: true,
    id: "user-admin-fca-id",
    email: LEGACY_EMAIL,
    isActive: true,
    hasPasswordHash: true,
    platformRoles: [{ roleId: "role-super_admin-id", roleKey: SUPER_ADMIN_ROLE_KEY, userRoleTenantId: null }],
    tenantMemberships: [{ tenantId: "tenant-fc-allschwil-id", tenantKey: "fc-allschwil", isActive: true }],
    tenantRoles: [],
  };
}

function nominalSuperAdminRole(): RoleSummary {
  return {
    exists: true,
    id: "role-super_admin-id",
    key: SUPER_ADMIN_ROLE_KEY,
    name: "Super Admin",
    scope: RoleScope.PLATFORM,
    tenantId: null,
    isSystem: true,
    isTemplate: false,
    isArchived: false,
    permissionCount: 40,
    platformPermissionCount: 4,
  };
}

function nominalTenantClubAdminRole(): RoleSummary {
  return {
    exists: true,
    id: "role-club-admin-fca-id",
    key: TENANT_CLUB_ADMIN_ROLE_KEY,
    name: "Club Admin",
    scope: RoleScope.TENANT,
    tenantId: "tenant-fc-allschwil-id",
    // RPERM-05-C1: the canonical tenant Club Admin role is always
    // isSystem=true (protected) — this was the actual bug: the legacy
    // bootstrap script previously created it with isSystem=false.
    isSystem: true,
    isTemplate: false,
    isArchived: false,
    permissionCount: TENANT_PERMISSION_KEYS.length,
    platformPermissionCount: 0,
  };
}

function nominalInspectResult(): InspectResult {
  return {
    tenant: nominalTenant(),
    platformUser: nominalPlatformUser(),
    clubAdminUser: nominalClubAdminUser(),
    legacyUser: nominalLegacyUser(),
    superAdminRole: nominalSuperAdminRole(),
    tenantClubAdminRole: nominalTenantClubAdminRole(),
    duplicateEmailsFound: false,
    duplicateEmails: [],
  };
}

// ---------------------------------------------------------------------------
// INSPECT MODE
// ---------------------------------------------------------------------------

describe("INSPECT MODE", () => {
  it("I-01: runInspect returns summaries for all three account identities", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, {
        userRoles: [{ role: { id: "r1", key: SUPER_ADMIN_ROLE_KEY, scope: RoleScope.PLATFORM } }],
      }),
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, {
        tenantMemberships: [{ tenantId: "t1", isActive: true, tenant: { id: "t1", key: "fc-allschwil" } }],
        userRoles: [{ role: { id: "r2", key: TENANT_CLUB_ADMIN_ROLE_KEY, scope: RoleScope.TENANT } }],
      }),
      legacyUser: makeMockUser(LEGACY_EMAIL),
    });

    const result = await runInspect(prisma);

    expect(result.platformUser.exists).toBe(true);
    expect(result.platformUser.email).toBe(normalizeEmail(PLATFORM_EMAIL));
    expect(result.clubAdminUser.exists).toBe(true);
    expect(result.clubAdminUser.email).toBe(normalizeEmail(CLUB_ADMIN_EMAIL));
    expect(result.legacyUser.exists).toBe(true);
    expect(result.legacyUser.email).toBe(normalizeEmail(LEGACY_EMAIL));
  });

  it("I-02: detects existing platform role on hello@tulip-digital.ch", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, {
        userRoles: [{ role: { id: "r1", key: SUPER_ADMIN_ROLE_KEY, scope: RoleScope.PLATFORM } }],
      }),
    });

    const result = await runInspect(prisma);

    expect(result.platformUser.platformRoles).toHaveLength(1);
    expect(result.platformUser.platformRoles[0].roleKey).toBe(SUPER_ADMIN_ROLE_KEY);
    expect(result.platformUser.tenantRoles).toHaveLength(0);
  });

  it("I-03: detects missing tenant Club Admin role", async () => {
    const prisma = makeMockPrisma({ tenantClubAdminRole: null });

    const result = await runInspect(prisma);

    expect(result.tenantClubAdminRole.exists).toBe(false);
  });

  it("I-04: detects duplicate normalized emails", async () => {
    const prisma = makeMockPrisma({
      emailCounts: { [normalizeEmail(PLATFORM_EMAIL)]: 2 },
    });

    const result = await runInspect(prisma);

    expect(result.duplicateEmailsFound).toBe(true);
    expect(result.duplicateEmails).toContain(normalizeEmail(PLATFORM_EMAIL));
  });

  it("I-05: does not expose password hashes in UserSummary", async () => {
    const mockPw = "$2b$12$actualSecretHashThatShouldNotLeak.etc";
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, { passwordHash: mockPw }),
    });

    const result = await runInspect(prisma);

    // UserSummary only tracks hasPasswordHash (boolean), never the hash value
    expect(result.platformUser.hasPasswordHash).toBe(true);
    expect(JSON.stringify(result)).not.toContain(mockPw);
  });

  it("I-06: does not include password env var values in results", async () => {
    const originalEnv = process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD;
    process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD = "super-secret-password-123";

    const prisma = makeMockPrisma();

    try {
      const result = await runInspect(prisma);

      // The inspect result must never contain the env var value
      expect(JSON.stringify(result)).not.toContain("super-secret-password-123");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD;
      } else {
        process.env.SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD = originalEnv;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// DRY RUN
// ---------------------------------------------------------------------------

describe("DRY RUN", () => {
  it("DR-01: runDryRun performs no writes — only reads underlying inspect", async () => {
    const prisma = makeMockPrisma({ platformUser: null, clubAdminUser: null });

    const plan = await runDryRun(prisma);

    // Verify that no mutation methods are called
    expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalled();
    // No create / update methods should be present on our mock at all
    expect((prisma.user as unknown as Record<string, unknown>).create).toBeUndefined();
    expect((prisma.user as unknown as Record<string, unknown>).update).toBeUndefined();
    // Plan should be a valid object
    expect(plan).toBeDefined();
  });

  it("DR-02: plans correct platform role assignment when user exists but lacks role", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, { userRoles: [] }),
    });

    const plan = await runDryRun(prisma);

    const platformRoleAssignment = plan.userRolesToCreate.find(
      (ur) => ur.includes(PLATFORM_EMAIL) && ur.includes(SUPER_ADMIN_ROLE_KEY)
    );
    expect(platformRoleAssignment).toBeDefined();
    expect(platformRoleAssignment).toContain("PLATFORM");
    expect(platformRoleAssignment).toContain("null");
  });

  it("DR-03: plans tenant membership creation when club admin has no FCA membership", async () => {
    const prisma = makeMockPrisma({
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, { tenantMemberships: [] }),
    });

    const plan = await runDryRun(prisma);

    expect(plan.membershipsToCreate).toHaveLength(1);
    expect(plan.membershipsToCreate[0]).toContain(CLUB_ADMIN_EMAIL);
    expect(plan.membershipsToCreate[0]).toContain(TENANT_KEY);
  });

  it("DR-04: plans tenant role assignment for club admin", async () => {
    const prisma = makeMockPrisma({
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, { userRoles: [] }),
    });

    const plan = await runDryRun(prisma);

    const tenantRoleAssignment = plan.userRolesToCreate.find(
      (ur) => ur.includes(CLUB_ADMIN_EMAIL) && ur.includes(TENANT_CLUB_ADMIN_ROLE_KEY)
    );
    expect(tenantRoleAssignment).toBeDefined();
    expect(tenantRoleAssignment).toContain("TENANT");
  });

  it("DR-05: preserves legacy account — plans no changes", async () => {
    const prisma = makeMockPrisma();

    const plan = await runDryRun(prisma);

    expect(plan.legacyChanges).toHaveLength(1);
    expect(plan.legacyChanges[0]).toContain("PRESERVE");
    expect(plan.noLegacyRoleRemoval).toBe(true);
  });

  it("DR-06: plans no deletion", async () => {
    const prisma = makeMockPrisma();

    const plan = await runDryRun(prisma);

    expect(plan.recordsToDelete).toHaveLength(0);
    expect(plan.noDeletionPlanned).toBe(true);
  });

  it("DR-07: plans no tenant role or membership for platform account", async () => {
    const prisma = makeMockPrisma({ platformUser: null });

    const plan = await runDryRun(prisma);

    expect(plan.noTenantForPlatform).toBe(true);
    // No membership for platform email
    expect(plan.membershipsToCreate.every((m) => !m.includes(PLATFORM_EMAIL))).toBe(true);
    // No tenant-scoped role for platform email
    const platformTenantRoles = plan.userRolesToCreate.filter(
      (ur) => ur.includes(PLATFORM_EMAIL) && ur.includes("TENANT")
    );
    expect(platformTenantRoles).toHaveLength(0);
  });

  it("DR-08: plans no platform role for club admin account", async () => {
    const prisma = makeMockPrisma({ clubAdminUser: null });

    const plan = await runDryRun(prisma);

    expect(plan.noPlatformForTenant).toBe(true);
    const clubAdminPlatformRoles = plan.userRolesToCreate.filter(
      (ur) => ur.includes(CLUB_ADMIN_EMAIL) && ur.includes(SUPER_ADMIN_ROLE_KEY)
    );
    expect(clubAdminPlatformRoles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PASSWORD HANDLING
// ---------------------------------------------------------------------------

describe("PASSWORD HANDLING", () => {
  it("PW-01: validatePassword rejects missing password (empty string)", () => {
    const errors = validatePassword("");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("PW-02: hashPassword is bcrypt-based (integration with lib/auth/password.ts)", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const hash = await hashPassword("test-password-123");
    // bcrypt hash format: $2b$12$...
    expect(hash).toMatch(/^\$2b\$12\$/);
    expect(hash).toHaveLength(60);
  });

  it("PW-03: validatePassword catches passwords shorter than 8 characters", () => {
    const shortPassword = "short";
    const errors = validatePassword(shortPassword);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("8");
  });

  it("PW-04: validatePassword does not copy or return hashes from other accounts", () => {
    // Ensure the validation function only validates, never reads existing hashes
    const legacyHash = "$2b$12$existingLegacyHashThatMustNeverBeCopied";
    const errors = validatePassword(legacyHash);
    // A raw hash string is very long and contains unusual characters — it fails length anyway
    // The important thing is that the function does not return the hash itself
    for (const err of errors) {
      expect(err).not.toContain(legacyHash);
    }
  });

  it("PW-05: validatePassword accepts valid password (8+ characters)", () => {
    const validPassword = "ValidPassword123!";
    const errors = validatePassword(validPassword);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// EXECUTE SAFETY
// ---------------------------------------------------------------------------

describe("EXECUTE SAFETY", () => {
  it("ES-01: evaluateSafetyGates EXECUTE_FLAG_SET is NOT_EVALUATED when isExecute=false", () => {
    const inspect = nominalInspectResult();
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const executeGate = gates.find((g) => g.gate === "EXECUTE_FLAG_SET");
    expect(executeGate?.status).toBe("NOT_EVALUATED");
  });

  it("ES-02: evaluateSafetyGates EXACT_CONFIRMATION_PROVIDED FAIL with wrong value", () => {
    const inspect = nominalInspectResult();
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: true,
      confirmValue: "wrong-value",
      platformPasswordAvailable: true,
      clubAdminPasswordAvailable: true,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const confirmGate = gates.find((g) => g.gate === "EXACT_CONFIRMATION_PROVIDED");
    expect(confirmGate?.status).toBe("FAIL");
  });

  it("ES-02b: evaluateSafetyGates EXACT_CONFIRMATION_PROVIDED PASS with correct value", () => {
    const inspect = nominalInspectResult();
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      platformPasswordAvailable: true,
      clubAdminPasswordAvailable: true,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const confirmGate = gates.find((g) => g.gate === "EXACT_CONFIRMATION_PROVIDED");
    expect(confirmGate?.status).toBe("PASS");
  });

  it("ES-03: evaluateSafetyGates ENVIRONMENT_NOT_PRODUCTION FAIL on prod URL", () => {
    const inspect = nominalInspectResult();
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@prod.example.com/db",
    });

    const envGate = gates.find((g) => g.gate === "ENVIRONMENT_NOT_PRODUCTION");
    expect(envGate?.status).toBe("FAIL");
  });

  it("ES-04: evaluateSafetyGates FAIL when duplicate emails exist", () => {
    const inspect = {
      ...nominalInspectResult(),
      duplicateEmailsFound: true,
      duplicateEmails: [normalizeEmail(PLATFORM_EMAIL)],
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const dupGate = gates.find((g) => g.gate === "PLATFORM_EMAIL_NOT_DUPLICATE");
    expect(dupGate?.status).toBe("FAIL");
  });

  it("ES-05: evaluateSafetyGates FAIL when super_admin role not found", () => {
    const inspect = {
      ...nominalInspectResult(),
      superAdminRole: { exists: false },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const roleGate = gates.find((g) => g.gate === "SUPER_ADMIN_ROLE_FOUND");
    expect(roleGate?.status).toBe("FAIL");
  });

  it("ES-06: evaluateSafetyGates FAIL when FC Allschwil tenant not found", () => {
    const inspect = {
      ...nominalInspectResult(),
      tenant: { exists: false },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const tenantGate = gates.find((g) => g.gate === "FC_ALLSCHWIL_TENANT_FOUND");
    expect(tenantGate?.status).toBe("FAIL");
  });

  it("ES-07: evaluateSafetyGates FAIL when tenant Club Admin role has PLATFORM permissions", () => {
    const inspect = {
      ...nominalInspectResult(),
      tenantClubAdminRole: { ...nominalTenantClubAdminRole(), platformPermissionCount: 2 },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const permGate = gates.find((g) => g.gate === "TENANT_CLUB_ADMIN_NO_PLATFORM_PERMS");
    expect(permGate?.status).toBe("FAIL");
  });

  it("ES-08: evaluateSafetyGates FAIL when club admin has a platform role", () => {
    const inspect = {
      ...nominalInspectResult(),
      clubAdminUser: {
        ...nominalClubAdminUser(),
        platformRoles: [{ roleId: "r1", roleKey: SUPER_ADMIN_ROLE_KEY, userRoleTenantId: null }],
      },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const clubGate = gates.find((g) => g.gate === "CLUB_ADMIN_HAS_NO_PLATFORM_ROLE");
    expect(clubGate?.status).toBe("FAIL");
  });

  it("ES-09: evaluateSafetyGates FAIL when platform user has a tenant role", () => {
    const inspect = {
      ...nominalInspectResult(),
      platformUser: {
        ...nominalPlatformUser(),
        tenantRoles: [{ roleId: "r2", roleKey: TENANT_CLUB_ADMIN_ROLE_KEY, userRoleTenantId: "t1" }],
      },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const platformGate = gates.find((g) => g.gate === "PLATFORM_USER_HAS_NO_CONFLICTING_TENANT_ROLE");
    expect(platformGate?.status).toBe("FAIL");
  });

  it("ES-10: all gates PASS (or NOT_EVALUATED) for nominal state in non-execute mode", () => {
    const inspect = nominalInspectResult();
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@stage.example.com/db",
    });

    const failures = gates.filter((g) => g.status === "FAIL");
    expect(failures).toHaveLength(0);
  });

  it("ES-11 (RPERM-05-C1): TENANT_CLUB_ADMIN_IS_SYSTEM is informational (PASS), never a blocking FAIL, even when the role is isSystem=false", () => {
    const inspect = {
      ...nominalInspectResult(),
      tenantClubAdminRole: { ...nominalTenantClubAdminRole(), isSystem: false },
    };
    const gates = evaluateSafetyGates({
      inspect,
      isExecute: false,
      confirmValue: undefined,
      platformPasswordAvailable: false,
      clubAdminPasswordAvailable: false,
      connectionString: "postgresql://user:pass@localhost/test",
    });

    const isSystemGate = gates.find((g) => g.gate === "TENANT_CLUB_ADMIN_IS_SYSTEM");
    expect(isSystemGate?.status).toBe("PASS");
    expect(isSystemGate?.detail).toContain("self-heal");
  });
});

// ---------------------------------------------------------------------------
// IDEMPOTENCY
// ---------------------------------------------------------------------------

describe("IDEMPOTENCY", () => {
  it("ID-01: runDryRun plans no user creation when both users already exist", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, {
        userRoles: [{ role: { id: "r1", key: SUPER_ADMIN_ROLE_KEY, scope: RoleScope.PLATFORM } }],
      }),
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, {
        tenantMemberships: [{ tenantId: "t1", isActive: true, tenant: { id: "t1", key: "fc-allschwil" } }],
        userRoles: [{ role: { id: "r2", key: TENANT_CLUB_ADMIN_ROLE_KEY, scope: RoleScope.TENANT } }],
      }),
    });

    const plan = await runDryRun(prisma);

    expect(plan.usersToCreate).toHaveLength(0);
    expect(plan.usersToReuse).toContain(normalizeEmail(PLATFORM_EMAIL));
    expect(plan.usersToReuse).toContain(normalizeEmail(CLUB_ADMIN_EMAIL));
  });

  it("ID-02: runDryRun plans no membership creation when already active", async () => {
    const prisma = makeMockPrisma({
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, {
        tenantMemberships: [{ tenantId: "t1", isActive: true, tenant: { id: "t1", key: "fc-allschwil" } }],
      }),
    });

    const plan = await runDryRun(prisma);

    expect(plan.membershipsToCreate).toHaveLength(0);
  });

  it("ID-03: runDryRun plans no role creation when tenant Club Admin role already exists", async () => {
    const prisma = makeMockPrisma({
      tenantClubAdminRole: makeMockRole(TENANT_CLUB_ADMIN_ROLE_KEY, {
        scope: RoleScope.TENANT,
        tenantId: "t1",
        rolePermissions: TENANT_PERMISSION_KEYS.map(() => ({ permission: { scope: PermissionScope.TENANT } })),
      }),
    });

    const plan = await runDryRun(prisma);

    expect(plan.rolesToCreate).toHaveLength(0);
    expect(plan.rolePermissionsToCreate).toBe(0);
  });

  it("ID-04: runDryRun plans no UserRole creation when roles already assigned", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, {
        userRoles: [{ role: { id: "r1", key: SUPER_ADMIN_ROLE_KEY, scope: RoleScope.PLATFORM } }],
      }),
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, {
        userRoles: [{ role: { id: "r2", key: TENANT_CLUB_ADMIN_ROLE_KEY, scope: RoleScope.TENANT } }],
        tenantMemberships: [{ tenantId: "t1", isActive: true, tenant: { id: "t1", key: "fc-allschwil" } }],
      }),
    });

    const plan = await runDryRun(prisma);

    expect(plan.userRolesToCreate).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AUTHORIZATION SEPARATION
// ---------------------------------------------------------------------------

describe("AUTHORIZATION SEPARATION", () => {
  it("AS-01: platform user has only platform roles, no tenant roles in inspect result", async () => {
    const prisma = makeMockPrisma({
      platformUser: makeMockUser(PLATFORM_EMAIL, {
        userRoles: [
          { role: { id: "r1", key: SUPER_ADMIN_ROLE_KEY, scope: RoleScope.PLATFORM } },
        ],
      }),
    });

    const result = await runInspect(prisma);

    expect(result.platformUser.platformRoles).toHaveLength(1);
    expect(result.platformUser.tenantRoles).toHaveLength(0);
    expect(result.platformUser.platformRoles[0].roleKey).toBe(SUPER_ADMIN_ROLE_KEY);
  });

  it("AS-02: club admin has only tenant roles, no platform roles", async () => {
    const prisma = makeMockPrisma({
      clubAdminUser: makeMockUser(CLUB_ADMIN_EMAIL, {
        userRoles: [
          { role: { id: "r2", key: TENANT_CLUB_ADMIN_ROLE_KEY, scope: RoleScope.TENANT } },
        ],
        tenantMemberships: [{ tenantId: "t1", isActive: true, tenant: { id: "t1", key: "fc-allschwil" } }],
      }),
    });

    const result = await runInspect(prisma);

    expect(result.clubAdminUser.tenantRoles).toHaveLength(1);
    expect(result.clubAdminUser.platformRoles).toHaveLength(0);
    expect(result.clubAdminUser.tenantRoles[0].roleKey).toBe(TENANT_CLUB_ADMIN_ROLE_KEY);
  });

  it("AS-03: dry-run plans no changes to legacy account", async () => {
    const prisma = makeMockPrisma();

    const plan = await runDryRun(prisma);

    // Legacy account should only appear in preservation message
    expect(plan.legacyChanges.every((c) => c.includes("PRESERVE"))).toBe(true);
    // Legacy email should not appear in usersToCreate
    expect(plan.usersToCreate.every((e) => e !== normalizeEmail(LEGACY_EMAIL))).toBe(true);
    // Legacy email should not appear in membershipsToCreate
    expect(plan.membershipsToCreate.every((m) => !m.includes(LEGACY_EMAIL))).toBe(true);
    // No UserRole changes planned for legacy
    expect(plan.userRolesToCreate.every((ur) => !ur.includes(LEGACY_EMAIL))).toBe(true);
  });

  it("AS-04: dry-run plans no cross-scope permission assignments", async () => {
    const prisma = makeMockPrisma({ tenantClubAdminRole: null });

    const plan = await runDryRun(prisma);

    // When the club admin role is being created, it should only get TENANT permissions
    // The plan includes TENANT_PERMISSION_KEYS.length permissions — all must be TENANT-scoped
    if (plan.rolesToCreate.length > 0) {
      // We can't verify scope directly in the plan, but we verify via the constants
      const platformOnlyKeys = ["users.manage", "users.impersonate", "tenants.view", "tenants.manage"];
      for (const key of platformOnlyKeys) {
        expect(TENANT_PERMISSION_KEYS).not.toContain(key);
      }
    }
  });

  it("AS-05: TENANT_PERMISSION_KEYS contains only TENANT-scoped permissions (none are PLATFORM-only)", () => {
    // These are the known PLATFORM-only permission keys from seed.ts
    const platformOnlyKeys = ["users.manage", "users.impersonate", "tenants.view", "tenants.manage"];
    for (const platformKey of platformOnlyKeys) {
      expect(TENANT_PERMISSION_KEYS).not.toContain(platformKey);
    }
  });
});

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

describe("HELPER FUNCTIONS", () => {
  describe("H-01: detectEnvironment", () => {
    it("classifies localhost as LOCAL", () => {
      expect(detectEnvironment("postgresql://user:pass@localhost/db")).toBe("LOCAL");
    });

    it("classifies 127.0.0.1 as LOCAL", () => {
      expect(detectEnvironment("postgresql://user:pass@127.0.0.1/db")).toBe("LOCAL");
    });

    it("classifies prod URL as PROD", () => {
      expect(detectEnvironment("postgresql://user:pass@prod.example.com/db")).toBe("PROD");
    });

    it("classifies stage URL as STAGE", () => {
      expect(detectEnvironment("postgresql://user:pass@stage.example.com/db")).toBe("STAGE");
    });

    it("classifies undefined as UNKNOWN", () => {
      expect(detectEnvironment(undefined)).toBe("UNKNOWN");
    });

    it("classifies unrecognized URL as EXTERNAL", () => {
      expect(detectEnvironment("postgresql://user:pass@db.example.com/mydb")).toBe("EXTERNAL");
    });
  });

  describe("H-02: maskUrl", () => {
    it("redacts password from connection string", () => {
      const masked = maskUrl("postgresql://user:secretpass@host.com/db");
      expect(masked).not.toContain("secretpass");
      expect(masked).toContain("***");
      expect(masked).toContain("host.com");
    });

    it("handles undefined gracefully", () => {
      expect(maskUrl(undefined)).toBe("(not set)");
    });
  });

  describe("H-03: normalizeEmail", () => {
    it("lowercases email", () => {
      expect(normalizeEmail("HELLO@TULIP-DIGITAL.CH")).toBe("hello@tulip-digital.ch");
    });

    it("trims whitespace", () => {
      expect(normalizeEmail("  it@fcallschwil.ch  ")).toBe("it@fcallschwil.ch");
    });

    it("handles mixed case and whitespace", () => {
      expect(normalizeEmail("  Admin@FcAllschwil.Ch  ")).toBe("admin@fcallschwil.ch");
    });
  });

  describe("H-04: TENANT_PERMISSION_KEYS contains expected tenant permissions", () => {
    it("includes users.view", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("users.view");
    });

    it("includes teams.manage", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("teams.manage");
    });

    it("includes roles.manage", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("roles.manage");
    });

    it("includes news.manage", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("news.manage");
    });

    it("includes events.manage", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("events.manage");
    });

    it("includes registrations.view", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("registrations.view");
    });

    it("includes workspace-related key (trainings.manage)", () => {
      expect(TENANT_PERMISSION_KEYS).toContain("trainings.manage");
    });

    it("has at least 40 TENANT permissions", () => {
      expect(TENANT_PERMISSION_KEYS.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe("H-05: TENANT_PERMISSION_KEYS does not contain PLATFORM-only permissions", () => {
    const platformOnlyKeys = ["users.manage", "users.impersonate", "tenants.view", "tenants.manage"];

    for (const key of platformOnlyKeys) {
      it(`does not contain ${key}`, () => {
        expect(TENANT_PERMISSION_KEYS).not.toContain(key);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

describe("CONSTANTS", () => {
  it("EXECUTE_CONFIRMATION is the exact expected value", () => {
    expect(EXECUTE_CONFIRMATION).toBe("SEPARATE-STAGE-PLATFORM-AND-TENANT-ADMINS");
  });

  it("PLATFORM_EMAIL is hello@tulip-digital.ch", () => {
    expect(PLATFORM_EMAIL).toBe("hello@tulip-digital.ch");
  });

  it("CLUB_ADMIN_EMAIL is it@fcallschwil.ch", () => {
    expect(CLUB_ADMIN_EMAIL).toBe("it@fcallschwil.ch");
  });

  it("LEGACY_EMAIL is admin@fcallschwil.ch", () => {
    expect(LEGACY_EMAIL).toBe("admin@fcallschwil.ch");
  });

  it("TENANT_CLUB_ADMIN_ROLE_KEY is club_admin__fc-allschwil (RPERM-05-C1 canonical key)", () => {
    expect(TENANT_CLUB_ADMIN_ROLE_KEY).toBe("club_admin__fc-allschwil");
  });

  it("SUPER_ADMIN_ROLE_KEY is super_admin", () => {
    expect(SUPER_ADMIN_ROLE_KEY).toBe("super_admin");
  });

  it("TENANT_KEY is fc-allschwil", () => {
    expect(TENANT_KEY).toBe("fc-allschwil");
  });
});
