/**
 * ORG-ACCESS-03 — Planning Authorization Policy Tests
 *
 * Unit-level tests using mock Prisma (vi.fn()) for isolation.
 *
 * Covers:
 *
 * VISIBILITY (broad read)
 *   PA-V-01  OrgUnit scope does NOT filter Center visibility — this is a
 *            policy concern, not enforced here; the policy's getWritableTeamIds
 *            returns write-scope only and is separate from read queries.
 *
 * canCreateForTeam
 *   PA-C-01  Tenant-wide coordinator → allowed, isCoordinator=true
 *   PA-C-02  Scoped user with THIS_ORG_UNIT on team's OrgUnit → allowed, isScoped=true
 *   PA-C-03  Scoped user with THIS_ORG_UNIT_AND_DESCENDANTS on parent → allowed, isScoped=true
 *   PA-C-04  Unrelated scoped user → denied
 *   PA-C-05  No team (teamId=null) + no coordinator → denied
 *   PA-C-06  Team with no canonical OrgUnit → denied
 *
 * canEditPlanningRecord
 *   PA-E-01  Coordinator edits DRAFT MANUAL record → allowed
 *   PA-E-02  Coordinator edits SUBMITTED record → allowed
 *   PA-E-03  Coordinator edits APPROVED record → allowed
 *   PA-E-04  Scoped user edits their DRAFT record → allowed
 *   PA-E-05  Scoped user on SUBMITTED record → denied (stage lock)
 *   PA-E-06  Scoped user on APPROVED record → denied (stage lock)
 *   PA-E-07  SFV record → coordinator only
 *   PA-E-08  SFV record + scoped user → denied
 *
 * canSubmitPlanningRecord
 *   PA-S-01  Scoped user submits DRAFT → allowed
 *   PA-S-02  Scoped user submits SUBMITTED → denied (not DRAFT)
 *   PA-S-03  Coordinator submits DRAFT → allowed
 *
 * canValidatePlanningRecord
 *   PA-V-01  Coordinator validates SUBMITTED → allowed
 *   PA-V-02  Scoped user validates SUBMITTED → denied
 *   PA-V-03  Coordinator validates DRAFT → denied (must be SUBMITTED)
 *
 * getWritableTeamIds
 *   PA-W-01  Coordinator → all teams
 *   PA-W-02  Scoped user with THIS_ORG_UNIT → only exact team
 *   PA-W-03  Scoped user with THIS_ORG_UNIT_AND_DESCENDANTS on parent → parent + child teams
 *   PA-W-04  User with no scope → empty list
 *
 * SFV protection
 *   PA-SFV-01  SFV source → always protected from scoped users
 *   PA-SFV-02  CLUBCORNER_FVNWS source → protected from scoped users
 *   PA-SFV-03  CSV_EXCEL_IMPORT → protected from scoped users
 *   PA-SFV-04  MANUAL source → accessible to scoped user with scope
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PlanningAuthorizationPolicy } from "../planning-authorization-policy";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  team: { findFirst: MockFn; findMany: MockFn };
  teamSeason: { findFirst: MockFn };
  tenantMembership: { findUnique: MockFn };
  orgUnit: { findUnique: MockFn };
  userRole: { findMany: MockFn };
}

function makeMockPrisma(overrides: Partial<MockPrisma> = {}): PrismaClient {
  return {
    team: {
      findFirst: overrides.team?.findFirst ?? vi.fn().mockResolvedValue(null),
      findMany: overrides.team?.findMany ?? vi.fn().mockResolvedValue([]),
    },
    teamSeason: {
      findFirst: overrides.teamSeason?.findFirst ?? vi.fn().mockResolvedValue(null),
    },
    tenantMembership: {
      findUnique:
        overrides.tenantMembership?.findUnique ??
        vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
    },
    orgUnit: {
      findUnique: overrides.orgUnit?.findUnique ?? vi.fn().mockResolvedValue(null),
    },
    userRole: {
      findMany: overrides.userRole?.findMany ?? vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient;
}

// Shared fixture IDs
const TENANT_ID = "tenant-1";
const USER_ID = "user-scoped";
const COORDINATOR_ID = "user-coordinator";
const TEAM_ID = "team-f2";
const ORG_UNIT_F2 = "ou-f2";
const ORG_UNIT_JUNIOREN = "ou-junioren"; // parent of F2
const ORG_UNIT_AKTIVE = "ou-aktive";    // sibling/unrelated

// Team row with current-season OrgUnit
function makeTeamWithOrgUnit(teamId: string, orgUnitId: string) {
  return {
    id: teamId,
    orgUnitId: null, // canonical path via teamSeasons
    teamSeasons: [
      {
        orgUnits: [{ orgUnitId }],
      },
    ],
  };
}

// OrgUnit ancestor chain fixture
function makeOrgUnit(id: string, parentId: string | null = null) {
  return {
    id,
    tenantId: TENANT_ID,
    parentId,
    parent: parentId
      ? { id: parentId, parentId: null, parent: null }
      : null,
  };
}

// UserRole for tenant-wide coordinator
function coordinatorRole(permission: string) {
  return {
    orgUnitId: null,
    scopeMode: null,
    tenantId: TENANT_ID,
    role: {
      scope: "TENANT",
      tenantId: TENANT_ID,
      isArchived: false,
      rolePermissions: [{ permission: { key: permission, scope: "TENANT" } }],
    },
  };
}

// UserRole for scoped user
function scopedRole(orgUnitId: string, scopeMode: string, permission: string) {
  return {
    orgUnitId,
    scopeMode,
    tenantId: TENANT_ID,
    role: {
      scope: "TENANT",
      tenantId: TENANT_ID,
      isArchived: false,
      rolePermissions: [{ permission: { key: permission, scope: "TENANT" } }],
    },
  };
}

// ---------------------------------------------------------------------------
// canCreateForTeam
// ---------------------------------------------------------------------------

describe("PlanningAuthorizationPolicy.canCreateForTeam", () => {
  it("PA-C-01: tenant-wide coordinator is always allowed", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole("events.manage")]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: COORDINATOR_ID, tenantId: TENANT_ID },
      "match",
      TEAM_ID,
    );

    expect(result.allowed).toBe(true);
    expect(result.isCoordinator).toBe(true);
    expect(result.isScoped).toBe(false);
  });

  it("PA-C-02: THIS_ORG_UNIT scoped user for team's OrgUnit → allowed", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        // getEffectivePermissions calls findMany TWICE: once for platform, once for tenant.
        // hasPermissionInOrgUnit then calls findMany a third time for scoped assignments.
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform roles → empty
          .mockResolvedValueOnce([]) // call 2: tenant-wide roles → empty (not coordinator)
          .mockResolvedValueOnce([scopedRole(ORG_UNIT_F2, "THIS_ORG_UNIT", "events.manage")]), // call 3: OrgUnit check
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: {
        findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
      TEAM_ID,
    );

    expect(result.allowed).toBe(true);
    expect(result.isScoped).toBe(true);
    expect(result.isCoordinator).toBe(false);
  });

  it("PA-C-03: THIS_ORG_UNIT_AND_DESCENDANTS on parent covers child team", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([
            scopedRole(ORG_UNIT_JUNIOREN, "THIS_ORG_UNIT_AND_DESCENDANTS", "events.manage"),
          ]), // call 3: OrgUnit check
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: {
        // F2's ancestor chain includes JUNIOREN (parent)
        findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2, ORG_UNIT_JUNIOREN)),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
      TEAM_ID,
    );

    expect(result.allowed).toBe(true);
    expect(result.isScoped).toBe(true);
  });

  it("PA-C-04: unrelated scoped user → denied", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([
            scopedRole(ORG_UNIT_AKTIVE, "THIS_ORG_UNIT", "events.manage"),
          ]), // call 3: OrgUnit check - AKTIVE, not F2 → denied
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: {
        findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
      TEAM_ID,
    );

    expect(result.allowed).toBe(false);
  });

  it("PA-C-05: no team + no coordinator → denied", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
      null,
    );

    expect(result.allowed).toBe(false);
  });

  it("PA-C-06: team with no OrgUnit → denied for scoped user", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([
            scopedRole(ORG_UNIT_F2, "THIS_ORG_UNIT", "events.manage"),
          ]), // call 3: (not reached because team has no OrgUnit)
      },
      team: {
        findFirst: vi.fn().mockResolvedValue({ id: TEAM_ID, orgUnitId: null, teamSeasons: [] }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const result = await policy.canCreateForTeam(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
      TEAM_ID,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/OrgUnit/i);
  });
});

// ---------------------------------------------------------------------------
// canEditPlanningRecord
// ---------------------------------------------------------------------------

describe("PlanningAuthorizationPolicy.canEditPlanningRecord", () => {
  function makeCoordinatorPrisma(permission: string) {
    return makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole(permission)]),
      },
    });
  }

  function makeScopedPrisma(orgUnitId: string, permission: string, teamOrgUnit: string) {
    return makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        // getEffectivePermissions: platform (call 1) + tenant (call 2)
        // hasPermissionInOrgUnit: scoped assignments (call 3)
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform → empty
          .mockResolvedValueOnce([]) // call 2: tenant-wide → empty (not coordinator)
          .mockResolvedValueOnce([scopedRole(orgUnitId, "THIS_ORG_UNIT", permission)]), // call 3
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, teamOrgUnit)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: {
        findUnique: vi.fn().mockResolvedValue(makeOrgUnit(teamOrgUnit)),
      },
    });
  }

  it("PA-E-01: coordinator edits DRAFT MANUAL record", async () => {
    const policy = new PlanningAuthorizationPolicy(makeCoordinatorPrisma("events.manage"));
    expect(
      await policy.canEditPlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "MANUAL" },
      ),
    ).toBe(true);
  });

  it("PA-E-02: coordinator edits SUBMITTED record", async () => {
    const policy = new PlanningAuthorizationPolicy(makeCoordinatorPrisma("events.manage"));
    expect(
      await policy.canEditPlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "SUBMITTED", source: "MANUAL" },
      ),
    ).toBe(true);
  });

  it("PA-E-03: coordinator edits APPROVED record", async () => {
    const policy = new PlanningAuthorizationPolicy(makeCoordinatorPrisma("events.manage"));
    expect(
      await policy.canEditPlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "APPROVED", source: "MANUAL" },
      ),
    ).toBe(true);
  });

  it("PA-E-04: scoped user edits DRAFT record for their team", async () => {
    const policy = new PlanningAuthorizationPolicy(
      makeScopedPrisma(ORG_UNIT_F2, "events.manage", ORG_UNIT_F2),
    );
    expect(
      await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "MANUAL" },
      ),
    ).toBe(true);
  });

  it("PA-E-05: scoped user → SUBMITTED record locked", async () => {
    const policy = new PlanningAuthorizationPolicy(
      makeScopedPrisma(ORG_UNIT_F2, "events.manage", ORG_UNIT_F2),
    );
    expect(
      await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "SUBMITTED", source: "MANUAL" },
      ),
    ).toBe(false);
  });

  it("PA-E-06: scoped user → APPROVED record locked", async () => {
    const policy = new PlanningAuthorizationPolicy(
      makeScopedPrisma(ORG_UNIT_F2, "events.manage", ORG_UNIT_F2),
    );
    expect(
      await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "APPROVED", source: "MANUAL" },
      ),
    ).toBe(false);
  });

  it("PA-E-07: SFV record → coordinator only", async () => {
    const coordinatorPolicy = new PlanningAuthorizationPolicy(
      makeCoordinatorPrisma("events.manage"),
    );
    expect(
      await coordinatorPolicy.canEditPlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "APPROVED", source: "SFV" },
      ),
    ).toBe(true);
  });

  it("PA-E-08: SFV record + scoped user → denied", async () => {
    const policy = new PlanningAuthorizationPolicy(
      makeScopedPrisma(ORG_UNIT_F2, "events.manage", ORG_UNIT_F2),
    );
    // SFV source short-circuits to coordinator-only
    // makeScopedPrisma sets up userRole.findMany to return empty for coordinator check first
    // so the check will see SFV → coordinator check → no coordinator → false
    expect(
      await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "SFV" },
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canSubmitPlanningRecord
// ---------------------------------------------------------------------------

describe("PlanningAuthorizationPolicy.canSubmitPlanningRecord", () => {
  it("PA-S-01: scoped user submits DRAFT → allowed", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([scopedRole(ORG_UNIT_F2, "THIS_ORG_UNIT", "events.manage")]), // call 3: OrgUnit
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: { findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)) },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canSubmitPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "MANUAL" },
      ),
    ).toBe(true);
  });

  it("PA-S-02: scoped user submits SUBMITTED → denied (not DRAFT)", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        // canSubmitPlanningRecord checks stage first → SUBMITTED → returns false immediately
        findMany: vi.fn().mockResolvedValue([]),
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: { findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)) },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canSubmitPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "SUBMITTED", source: "MANUAL" },
      ),
    ).toBe(false);
  });

  it("PA-S-03: coordinator submits DRAFT → allowed", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole("events.manage")]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canSubmitPlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "MANUAL" },
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canValidatePlanningRecord
// ---------------------------------------------------------------------------

describe("PlanningAuthorizationPolicy.canValidatePlanningRecord", () => {
  it("PA-V-01: coordinator validates SUBMITTED → allowed", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole("events.manage")]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canValidatePlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "SUBMITTED" },
      ),
    ).toBe(true);
  });

  it("PA-V-02: scoped user cannot validate SUBMITTED", async () => {
    // canValidatePlanningRecord only checks isTenantWideCoordinator → must return false for scoped user
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        // Both platform and tenant-wide checks return empty → not coordinator
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    // canValidatePlanningRecord only grants coordinator
    expect(
      await policy.canValidatePlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "SUBMITTED" },
      ),
    ).toBe(false);
  });

  it("PA-V-03: coordinator cannot validate DRAFT (must be SUBMITTED)", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole("events.manage")]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canValidatePlanningRecord(
        { userId: COORDINATOR_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT" },
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SFV protection
// ---------------------------------------------------------------------------

describe("SFV / provider source protection", () => {
  const PROTECTED_SOURCES = ["SFV", "CLUBCORNER_FVNWS", "CSV_EXCEL_IMPORT"];

  for (const source of PROTECTED_SOURCES) {
    it(`PA-SFV: ${source} source → denied for scoped user`, async () => {
      const prisma = makeMockPrisma({
        tenantMembership: {
          findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
        },
        userRole: {
          // For SFV: canEditPlanningRecord short-circuits to isTenantWideCoordinator check.
          // isTenantWideCoordinator calls getEffectivePermissions: platform (call 1) + tenant (call 2).
          // Both return empty → not coordinator → return false.
          findMany: vi.fn().mockResolvedValue([]),
        },
        team: {
          findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
          findMany: vi.fn().mockResolvedValue([]),
        },
        orgUnit: { findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)) },
      });

      const policy = new PlanningAuthorizationPolicy(prisma);
      const result = await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source },
      );
      expect(result).toBe(false);
    });
  }

  it("PA-SFV-04: MANUAL source → accessible to scoped user with scope", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([scopedRole(ORG_UNIT_F2, "THIS_ORG_UNIT", "events.manage")]), // call 3: OrgUnit
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(makeTeamWithOrgUnit(TEAM_ID, ORG_UNIT_F2)),
        findMany: vi.fn().mockResolvedValue([]),
      },
      orgUnit: { findUnique: vi.fn().mockResolvedValue(makeOrgUnit(ORG_UNIT_F2)) },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    expect(
      await policy.canEditPlanningRecord(
        { userId: USER_ID, tenantId: TENANT_ID },
        "match",
        { teamId: TEAM_ID, planningStage: "DRAFT", source: "MANUAL" },
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getWritableTeamIds
// ---------------------------------------------------------------------------

describe("PlanningAuthorizationPolicy.getWritableTeamIds", () => {
  const TEAM_E3 = "team-e3";
  const ORG_UNIT_E3 = "ou-e3";

  it("PA-W-01: coordinator gets all teams", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([coordinatorRole("trainings.manage")]),
      },
      team: {
        findMany: vi.fn().mockResolvedValue([{ id: TEAM_ID }, { id: TEAM_E3 }]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const ids = await policy.getWritableTeamIds(
      { userId: COORDINATOR_ID, tenantId: TENANT_ID },
      "training",
    );
    expect(ids).toEqual([TEAM_ID, TEAM_E3]);
  });

  it("PA-W-02: THIS_ORG_UNIT scoped user gets only their team", async () => {
    // Two teams: F2 (in ORG_UNIT_F2) and E3 (in ORG_UNIT_E3)
    // User has scope for F2 only
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        // getWritableTeamIds: isTenantWideCoordinator calls getEffectivePermissions (2 findMany calls)
        // then loads scoped assignments (1 findMany call)
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform → empty
          .mockResolvedValueOnce([]) // call 2: tenant-wide → empty (not coordinator)
          .mockResolvedValueOnce([scopedRole(ORG_UNIT_F2, "THIS_ORG_UNIT", "events.manage")]), // call 3: scoped
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          {
            id: TEAM_ID,
            orgUnitId: null,
            teamSeasons: [{ orgUnits: [{ orgUnitId: ORG_UNIT_F2, orgUnit: { id: ORG_UNIT_F2, parentId: null, parent: null } }] }],
          },
          {
            id: TEAM_E3,
            orgUnitId: null,
            teamSeasons: [{ orgUnits: [{ orgUnitId: ORG_UNIT_E3, orgUnit: { id: ORG_UNIT_E3, parentId: null, parent: null } }] }],
          },
        ]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const ids = await policy.getWritableTeamIds(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
    );
    expect(ids).toEqual([TEAM_ID]); // F2 only
    expect(ids).not.toContain(TEAM_E3);
  });

  it("PA-W-03: THIS_ORG_UNIT_AND_DESCENDANTS on parent → both parent+child teams", async () => {
    const ORG_UNIT_CHILD = "ou-child";
    const TEAM_CHILD = "team-child";

    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([]) // call 1: platform
          .mockResolvedValueOnce([]) // call 2: tenant-wide (not coordinator)
          .mockResolvedValueOnce([
            scopedRole(ORG_UNIT_JUNIOREN, "THIS_ORG_UNIT_AND_DESCENDANTS", "events.manage"),
          ]), // call 3: scoped
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          {
            id: TEAM_ID,
            orgUnitId: null,
            teamSeasons: [{
              orgUnits: [{
                orgUnitId: ORG_UNIT_F2,
                orgUnit: { id: ORG_UNIT_F2, parentId: ORG_UNIT_JUNIOREN, parent: { id: ORG_UNIT_JUNIOREN, parentId: null } },
              }],
            }],
          },
          {
            id: TEAM_CHILD,
            orgUnitId: null,
            teamSeasons: [{
              orgUnits: [{
                orgUnitId: ORG_UNIT_CHILD,
                orgUnit: { id: ORG_UNIT_CHILD, parentId: ORG_UNIT_JUNIOREN, parent: { id: ORG_UNIT_JUNIOREN, parentId: null } },
              }],
            }],
          },
          {
            id: TEAM_E3,
            orgUnitId: null,
            teamSeasons: [{
              orgUnits: [{
                orgUnitId: ORG_UNIT_E3,
                orgUnit: { id: ORG_UNIT_E3, parentId: null, parent: null },
              }],
            }],
          },
        ]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const ids = await policy.getWritableTeamIds(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
    );
    expect(ids).toContain(TEAM_ID);
    expect(ids).toContain(TEAM_CHILD);
    expect(ids).not.toContain(TEAM_E3);
  });

  it("PA-W-04: user with no scope → empty list", async () => {
    const prisma = makeMockPrisma({
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      team: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const policy = new PlanningAuthorizationPolicy(prisma);
    const ids = await policy.getWritableTeamIds(
      { userId: USER_ID, tenantId: TENANT_ID },
      "match",
    );
    expect(ids).toEqual([]);
  });
});
