/**
 * scripts/__tests__/stage-cleanup-01-fca-canonical-data.test.ts
 *
 * STAGE-CLEANUP-01 — Automated tests for the FC Allschwil canonical data cleanup script.
 *
 * Test suites:
 *
 *   HELPER FUNCTIONS
 *     H-01  normalizeEmail lowercases and trims
 *     H-02  detectEnvironment correctly classifies URLs
 *     H-03  maskUrl redacts credentials
 *     H-04  isCanonicalUserEmail matches only the two canonical admins
 *     H-05  isCanonicalRoleKey matches only canonical system roles
 *     H-06  CANONICAL_ROLE_KEYS contains exactly the expected canonical set
 *
 *   DRY RUN PLAN (pure — built from an InventoryResult fixture)
 *     DR-01  Nominal inventory produces a conflict-free plan
 *     DR-02  Classifies non-canonical users for deletion, canonical users kept
 *     DR-03  Classifies non-canonical roles for deletion, canonical roles kept
 *     DR-04  Plans full registration deletion count
 *     DR-05  Flags missing platform (SCE Super Admin) user as a conflict
 *     DR-06  Flags missing club admin user as a conflict
 *     DR-07  Flags inactive platform user as a conflict
 *     DR-08  Flags club admin missing the tenant Club Admin role as a conflict
 *     DR-09  Flags duplicate canonical email as a conflict
 *     DR-10  Flags a canonical admin holding a role scheduled for deletion
 *     DR-11  Flags missing tenant as a conflict
 *     DR-12  Never plans changes to protected domains (always true)
 *
 *   SAFETY GATES
 *     SG-01  All gates PASS on a fully nominal execute-ready inventory
 *     SG-02  EXECUTE_FLAG_SET / EXACT_CONFIRMATION_PROVIDED are NOT_EVALUATED outside execute mode
 *     SG-03  EXACT_CONFIRMATION_PROVIDED FAILs on wrong confirmation string
 *     SG-04  ENVIRONMENT_NOT_PRODUCTION FAILs against a production-looking URL
 *     SG-05  PLATFORM_SUPER_ADMIN_VALID FAILs when hello@tulip-digital.ch is missing
 *     SG-06  CLUB_ADMIN_VALID FAILs when it@fcallschwil.ch is missing
 *     SG-07  NO_DUPLICATE_CANONICAL_EMAILS FAILs on duplicate canonical email
 *     SG-08  CANONICAL_ROLE_SET_VALID FAILs when club_admin_fc_allschwil has wrong scope
 *     SG-09  NO_CANONICAL_USER_HOLDS_NONCANONICAL_ROLE FAILs when a canonical admin
 *            holds a role scheduled for deletion
 *     SG-10  TENANT_FOUND FAILs when the tenant does not exist
 *
 *   CONSTANTS / IDENTITY
 *     C-01  PLATFORM_EMAIL is hello@tulip-digital.ch
 *     C-02  CLUB_ADMIN_EMAIL is it@fcallschwil.ch
 *     C-03  Exactly two canonical user emails
 *     C-04  EXECUTE_CONFIRMATION is a distinct, explicit string
 */

import { describe, it, expect } from "vitest";
import { RoleScope } from "@prisma/client";
import {
  PLATFORM_EMAIL,
  CLUB_ADMIN_EMAIL,
  CANONICAL_USER_EMAILS,
  SUPER_ADMIN_ROLE_KEY,
  TENANT_CLUB_ADMIN_ROLE_KEY,
  CANONICAL_ROLE_KEYS,
  TENANT_KEY,
  EXECUTE_CONFIRMATION,
  normalizeEmail,
  detectEnvironment,
  maskUrl,
  isCanonicalUserEmail,
  isCanonicalRoleKey,
  buildDryRunPlan,
  evaluateSafetyGates,
  type InventoryResult,
  type UserInventoryItem,
  type RoleInventoryItem,
} from "../stage-cleanup-01-fca-canonical-data";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<UserInventoryItem> & { email: string }): UserInventoryItem {
  const canonical = isCanonicalUserEmail(overrides.email);
  return {
    id: `user-${overrides.email}-id`,
    email: overrides.email,
    isActive: true,
    tenantId: null,
    tenantKey: null,
    roleKeys: [],
    classification: canonical ? "PROTECTED" : "REMOVE",
    reason: canonical ? "canonical" : "not canonical",
    ...overrides,
  };
}

function makeRole(overrides: Partial<RoleInventoryItem> & { key: string }): RoleInventoryItem {
  const canonical = isCanonicalRoleKey(overrides.key);
  return {
    id: `role-${overrides.key}-id`,
    key: overrides.key,
    name: overrides.key,
    scope: RoleScope.PLATFORM,
    tenantId: null,
    isSystem: false,
    isTemplate: false,
    assignedUserCount: 0,
    permissionCount: 0,
    classification: canonical ? "PROTECTED" : "REMOVE",
    reason: canonical ? "canonical" : "not canonical",
    ...overrides,
  };
}

function nominalPlatformUser(overrides: Partial<UserInventoryItem> = {}): UserInventoryItem {
  return makeUser({
    email: PLATFORM_EMAIL,
    tenantId: null,
    tenantKey: null,
    roleKeys: [SUPER_ADMIN_ROLE_KEY],
    ...overrides,
  });
}

function nominalClubAdminUser(overrides: Partial<UserInventoryItem> = {}): UserInventoryItem {
  return makeUser({
    email: CLUB_ADMIN_EMAIL,
    tenantId: "tenant-fc-allschwil-id",
    tenantKey: TENANT_KEY,
    roleKeys: [TENANT_CLUB_ADMIN_ROLE_KEY],
    ...overrides,
  });
}

function nominalCanonicalRoles(): RoleInventoryItem[] {
  return CANONICAL_ROLE_KEYS.map((key) =>
    makeRole({
      key,
      scope: key === TENANT_CLUB_ADMIN_ROLE_KEY ? RoleScope.TENANT : RoleScope.PLATFORM,
      tenantId: key === TENANT_CLUB_ADMIN_ROLE_KEY ? "tenant-fc-allschwil-id" : null,
      isSystem: key === SUPER_ADMIN_ROLE_KEY,
    })
  );
}

function nominalInventory(overrides: Partial<InventoryResult> = {}): InventoryResult {
  return {
    tenant: { exists: true, id: "tenant-fc-allschwil-id", key: TENANT_KEY, name: "FC Allschwil", status: "ACTIVE" },
    users: [
      nominalPlatformUser(),
      nominalClubAdminUser(),
      makeUser({ email: "admin@fcallschwil.ch", tenantId: "tenant-fc-allschwil-id", tenantKey: TENANT_KEY, roleKeys: [SUPER_ADMIN_ROLE_KEY] }),
      makeUser({ email: "demo@fcallschwil.ch", tenantId: "tenant-fc-allschwil-id", tenantKey: TENANT_KEY, roleKeys: [] }),
      makeUser({ email: "test@example.com", tenantId: null, tenantKey: null, roleKeys: [] }),
    ],
    roles: [...nominalCanonicalRoles(), makeRole({ key: "demo_role_seed" }), makeRole({ key: "qa_test_role" })],
    registrations: {
      totalCount: 16,
      byType: { PROBETRAINING: 14, SPIELERANMELDUNG: 2 },
      byStatus: { NEW: 16 },
      ids: Array.from({ length: 16 }, (_, i) => `reg-${i}`),
      relatedAuditLogCount: 0,
    },
    protectedDomainCounts: {
      teams: 3,
      teamSeasons: 3,
      competitions: 0,
      orgUnits: 2,
      orgUnitMemberships: 1,
      targetGroups: 0,
      people: 0,
      events: 4,
      facilities: 4,
      websitePages: 0,
      newsArticles: 0,
      websiteNavItems: 0,
      permissions: 48,
      seasons: 3,
    },
    duplicateCanonicalEmails: [],
    nonCanonicalUserDependentRecordCounts: {
      auditLogsAsActor: 0,
      orgUnitMemberships: 0,
      assignedRegistrations: 0,
      contentAuthorshipReferences: 0,
      workspaceAuthorshipReferences: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

describe("HELPER FUNCTIONS", () => {
  it("H-01: normalizeEmail lowercases and trims", () => {
    expect(normalizeEmail("  Hello@Tulip-Digital.ch  ")).toBe("hello@tulip-digital.ch");
  });

  it("H-02: detectEnvironment correctly classifies URLs", () => {
    expect(detectEnvironment(undefined)).toBe("UNKNOWN");
    expect(detectEnvironment("postgresql://u:p@my-prod-host.example.com/db")).toBe("PROD");
    expect(detectEnvironment("postgresql://u:p@my-stage-host.example.com/db")).toBe("STAGE");
    expect(detectEnvironment("postgresql://u:p@localhost:5432/db")).toBe("LOCAL");
    expect(detectEnvironment("postgresql://u:p@ep-silent-bird.neon.tech/db")).toBe("EXTERNAL");
  });

  it("H-03: maskUrl redacts credentials", () => {
    const masked = maskUrl("postgresql://neondb_owner:supersecret@ep-host.neon.tech/neondb");
    expect(masked).not.toContain("supersecret");
    expect(masked).toContain("***");
    expect(masked).toContain("neondb_owner");
    expect(maskUrl(undefined)).toBe("(not set)");
  });

  it("H-04: isCanonicalUserEmail matches only the two canonical admins", () => {
    expect(isCanonicalUserEmail(PLATFORM_EMAIL)).toBe(true);
    expect(isCanonicalUserEmail(CLUB_ADMIN_EMAIL)).toBe(true);
    expect(isCanonicalUserEmail(" HELLO@TULIP-DIGITAL.CH ")).toBe(true);
    expect(isCanonicalUserEmail("admin@fcallschwil.ch")).toBe(false);
    expect(isCanonicalUserEmail("demo@fcallschwil.ch")).toBe(false);
    expect(CANONICAL_USER_EMAILS).toHaveLength(2);
  });

  it("H-05: isCanonicalRoleKey matches only canonical system roles", () => {
    expect(isCanonicalRoleKey(SUPER_ADMIN_ROLE_KEY)).toBe(true);
    expect(isCanonicalRoleKey(TENANT_CLUB_ADMIN_ROLE_KEY)).toBe(true);
    expect(isCanonicalRoleKey("demo_role_seed")).toBe(false);
    expect(isCanonicalRoleKey("qa_test_role")).toBe(false);
  });

  it("H-06: CANONICAL_ROLE_KEYS contains exactly the expected canonical set", () => {
    expect(new Set(CANONICAL_ROLE_KEYS)).toEqual(
      new Set([
        "super_admin",
        "club_admin",
        "match_coordinator",
        "website_publisher",
        "trainer",
        "viewer",
        // RPERM-05-C1: canonical key, no longer the divergent legacy key.
        "club_admin__fc-allschwil",
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// DRY RUN PLAN
// ---------------------------------------------------------------------------

describe("DRY RUN PLAN", () => {
  it("DR-01: nominal inventory produces a conflict-free plan", () => {
    const plan = buildDryRunPlan(nominalInventory());
    expect(plan.conflicts).toEqual([]);
  });

  it("DR-02: classifies non-canonical users for deletion, canonical users kept", () => {
    const plan = buildDryRunPlan(nominalInventory());
    expect(plan.usersToKeep.sort()).toEqual([CLUB_ADMIN_EMAIL, PLATFORM_EMAIL].sort());
    expect(plan.usersToDelete.sort()).toEqual(["admin@fcallschwil.ch", "demo@fcallschwil.ch", "test@example.com"].sort());
  });

  it("DR-03: classifies non-canonical roles for deletion, canonical roles kept", () => {
    const plan = buildDryRunPlan(nominalInventory());
    expect(new Set(plan.rolesToKeep)).toEqual(new Set(CANONICAL_ROLE_KEYS));
    expect(plan.rolesToDelete.sort()).toEqual(["demo_role_seed", "qa_test_role"].sort());
  });

  it("DR-04: plans full registration deletion count", () => {
    const plan = buildDryRunPlan(nominalInventory());
    expect(plan.registrationsToDeleteCount).toBe(16);
  });

  it("DR-05: flags missing platform (SCE Super Admin) user as a conflict", () => {
    const inv = nominalInventory({ users: nominalInventory().users.filter((u) => u.email !== PLATFORM_EMAIL) });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(PLATFORM_EMAIL) && c.includes("not found"))).toBe(true);
  });

  it("DR-06: flags missing club admin user as a conflict", () => {
    const inv = nominalInventory({ users: nominalInventory().users.filter((u) => u.email !== CLUB_ADMIN_EMAIL) });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(CLUB_ADMIN_EMAIL) && c.includes("not found"))).toBe(true);
  });

  it("DR-07: flags inactive platform user as a conflict", () => {
    const base = nominalInventory();
    const inv = nominalInventory({
      users: base.users.map((u) => (u.email === PLATFORM_EMAIL ? { ...u, isActive: false } : u)),
    });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(PLATFORM_EMAIL) && c.includes("isActive=false"))).toBe(true);
  });

  it("DR-08: flags club admin missing the tenant Club Admin role as a conflict", () => {
    const base = nominalInventory();
    const inv = nominalInventory({
      users: base.users.map((u) => (u.email === CLUB_ADMIN_EMAIL ? { ...u, roleKeys: [] } : u)),
    });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(CLUB_ADMIN_EMAIL) && c.includes(TENANT_CLUB_ADMIN_ROLE_KEY))).toBe(true);
  });

  it("DR-09: flags duplicate canonical email as a conflict", () => {
    const inv = nominalInventory({ duplicateCanonicalEmails: [normalizeEmail(PLATFORM_EMAIL)] });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes("DUPLICATE CANONICAL EMAIL"))).toBe(true);
  });

  it("DR-10: flags a canonical admin holding a role scheduled for deletion", () => {
    const base = nominalInventory();
    const inv = nominalInventory({
      users: base.users.map((u) =>
        u.email === PLATFORM_EMAIL ? { ...u, roleKeys: [...u.roleKeys, "demo_role_seed"] } : u
      ),
    });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(PLATFORM_EMAIL) && c.includes("demo_role_seed"))).toBe(true);
  });

  it("DR-11: flags missing tenant as a conflict", () => {
    const inv = nominalInventory({ tenant: { exists: false } });
    const plan = buildDryRunPlan(inv);
    expect(plan.conflicts.some((c) => c.includes(TENANT_KEY) && c.includes("not found"))).toBe(true);
  });

  it("DR-12: never plans changes to protected domains", () => {
    const plan = buildDryRunPlan(nominalInventory());
    expect(plan.noOrgStructureChanges).toBe(true);
    expect(plan.noTeamsChanges).toBe(true);
    expect(plan.noCompetitionsChanges).toBe(true);
    expect(plan.noPermissionChanges).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SAFETY GATES
// ---------------------------------------------------------------------------

describe("SAFETY GATES", () => {
  it("SG-01: all gates PASS on a fully nominal execute-ready inventory", () => {
    const gates = evaluateSafetyGates({
      inventory: nominalInventory(),
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    for (const gate of gates) {
      expect(gate.status).toBe("PASS");
    }
  });

  it("SG-02: EXECUTE_FLAG_SET / EXACT_CONFIRMATION_PROVIDED are NOT_EVALUATED outside execute mode", () => {
    const gates = evaluateSafetyGates({
      inventory: nominalInventory(),
      isExecute: false,
      confirmValue: undefined,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "EXECUTE_FLAG_SET")?.status).toBe("NOT_EVALUATED");
    expect(gates.find((g) => g.gate === "EXACT_CONFIRMATION_PROVIDED")?.status).toBe("NOT_EVALUATED");
  });

  it("SG-03: EXACT_CONFIRMATION_PROVIDED FAILs on wrong confirmation string", () => {
    const gates = evaluateSafetyGates({
      inventory: nominalInventory(),
      isExecute: true,
      confirmValue: "WRONG-STRING",
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "EXACT_CONFIRMATION_PROVIDED")?.status).toBe("FAIL");
  });

  it("SG-04: ENVIRONMENT_NOT_PRODUCTION FAILs against a production-looking URL", () => {
    const gates = evaluateSafetyGates({
      inventory: nominalInventory(),
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@my-prod-db.example.com/db",
    });
    expect(gates.find((g) => g.gate === "ENVIRONMENT_NOT_PRODUCTION")?.status).toBe("FAIL");
  });

  it("SG-05: PLATFORM_SUPER_ADMIN_VALID FAILs when hello@tulip-digital.ch is missing", () => {
    const base = nominalInventory();
    const inv = nominalInventory({ users: base.users.filter((u) => u.email !== PLATFORM_EMAIL) });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "PLATFORM_SUPER_ADMIN_VALID")?.status).toBe("FAIL");
  });

  it("SG-06: CLUB_ADMIN_VALID FAILs when it@fcallschwil.ch is missing", () => {
    const base = nominalInventory();
    const inv = nominalInventory({ users: base.users.filter((u) => u.email !== CLUB_ADMIN_EMAIL) });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "CLUB_ADMIN_VALID")?.status).toBe("FAIL");
  });

  it("SG-07: NO_DUPLICATE_CANONICAL_EMAILS FAILs on duplicate canonical email", () => {
    const inv = nominalInventory({ duplicateCanonicalEmails: [normalizeEmail(CLUB_ADMIN_EMAIL)] });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "NO_DUPLICATE_CANONICAL_EMAILS")?.status).toBe("FAIL");
  });

  it("SG-08: CANONICAL_ROLE_SET_VALID FAILs when club_admin_fc_allschwil has wrong scope", () => {
    const base = nominalInventory();
    const inv = nominalInventory({
      roles: base.roles.map((r) => (r.key === TENANT_CLUB_ADMIN_ROLE_KEY ? { ...r, scope: RoleScope.PLATFORM } : r)),
    });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "CANONICAL_ROLE_SET_VALID")?.status).toBe("FAIL");
  });

  it("SG-09: NO_CANONICAL_USER_HOLDS_NONCANONICAL_ROLE FAILs when a canonical admin holds a role scheduled for deletion", () => {
    const base = nominalInventory();
    const inv = nominalInventory({
      users: base.users.map((u) =>
        u.email === CLUB_ADMIN_EMAIL ? { ...u, roleKeys: [...u.roleKeys, "qa_test_role"] } : u
      ),
    });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "NO_CANONICAL_USER_HOLDS_NONCANONICAL_ROLE")?.status).toBe("FAIL");
  });

  it("SG-10: TENANT_FOUND FAILs when the tenant does not exist", () => {
    const inv = nominalInventory({ tenant: { exists: false } });
    const gates = evaluateSafetyGates({
      inventory: inv,
      isExecute: true,
      confirmValue: EXECUTE_CONFIRMATION,
      connectionString: "postgresql://u:p@localhost:5432/db",
    });
    expect(gates.find((g) => g.gate === "TENANT_FOUND")?.status).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// CONSTANTS / IDENTITY
// ---------------------------------------------------------------------------

describe("CONSTANTS / IDENTITY", () => {
  it("C-01: PLATFORM_EMAIL is hello@tulip-digital.ch", () => {
    expect(PLATFORM_EMAIL).toBe("hello@tulip-digital.ch");
  });

  it("C-02: CLUB_ADMIN_EMAIL is it@fcallschwil.ch", () => {
    expect(CLUB_ADMIN_EMAIL).toBe("it@fcallschwil.ch");
  });

  it("C-03: exactly two canonical user emails", () => {
    expect(CANONICAL_USER_EMAILS).toHaveLength(2);
    expect(CANONICAL_USER_EMAILS).toContain(PLATFORM_EMAIL);
    expect(CANONICAL_USER_EMAILS).toContain(CLUB_ADMIN_EMAIL);
  });

  it("C-04: EXECUTE_CONFIRMATION is a distinct, explicit string", () => {
    expect(EXECUTE_CONFIRMATION.length).toBeGreaterThan(10);
    expect(EXECUTE_CONFIRMATION).toBe("CLEAN-FCA-CANONICAL-DATA");
  });
});
