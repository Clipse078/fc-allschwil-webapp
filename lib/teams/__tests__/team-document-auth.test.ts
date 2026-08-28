/**
 * @vitest-environment node
 *
 * TEAM-COCKPIT-PREMIUM-01J-C — Team Document authorization security matrix.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  teamFindFirst: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  playerSquadMemberFindFirst: vi.fn(),
  trainerTeamMemberFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  userRoleCount: vi.fn(),
  tenantFindUnique: vi.fn(),
  auth: vi.fn(),
  getActiveTenant: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: { findFirst: (...args: unknown[]) => mocks.teamFindFirst(...args) },
    teamSeason: {
      findFirst: (...args: unknown[]) => mocks.teamSeasonFindFirst(...args),
    },
    playerSquadMember: {
      findFirst: (...args: unknown[]) => mocks.playerSquadMemberFindFirst(...args),
    },
    trainerTeamMember: {
      findFirst: (...args: unknown[]) => mocks.trainerTeamMemberFindFirst(...args),
    },
    person: { findFirst: (...args: unknown[]) => mocks.personFindFirst(...args) },
    userRole: { count: (...args: unknown[]) => mocks.userRoleCount(...args) },
    tenant: { findUnique: (...args: unknown[]) => mocks.tenantFindUnique(...args) },
  },
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import {
  requireApiTeamDocumentAccess,
  requireTeamDocumentAccess,
  resolvePersonCurrentTeamAllocation,
  resolveTeamDocumentAccess,
} from "@/lib/teams/team-document-auth";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TENANT_KEY_A = "fca";
const TENANT_KEY_B = "other-club";
const TEAM_A = "team-a";
const TEAM_B = "team-b";
const USER_ID = "user-1";
const PERSON_ID = "person-1";
const CURRENT_TEAM_SEASON_ID = "team-season-current";

function mockTeamExists() {
  mocks.teamFindFirst.mockResolvedValue({ id: TEAM_A });
}

function mockNoSpecialRoles() {
  mocks.userRoleCount.mockResolvedValue(0);
}

function mockClubAdmin() {
  mocks.userRoleCount.mockImplementation(async (args: { where: { role?: { key?: string } } }) => {
    if (args.where.role?.key?.startsWith("club_admin__")) return 1;
    return 0;
  });
}

function mockSuperAdmin() {
  mocks.userRoleCount.mockImplementation(async (args: { where: { role?: { key?: string } } }) => {
    if (args.where.role?.key === "super_admin") return 1;
    return 0;
  });
}

function mockPersonLinked() {
  mocks.personFindFirst.mockResolvedValue({ id: PERSON_ID });
}

function mockCurrentTeamSeason() {
  mocks.teamSeasonFindFirst.mockResolvedValue({ id: CURRENT_TEAM_SEASON_ID });
}

function mockPlayerAllocation() {
  mocks.playerSquadMemberFindFirst.mockResolvedValue({ id: "squad-1" });
  mocks.trainerTeamMemberFindFirst.mockResolvedValue(null);
}

function mockTrainerAllocation() {
  mocks.playerSquadMemberFindFirst.mockResolvedValue(null);
  mocks.trainerTeamMemberFindFirst.mockResolvedValue({ id: "trainer-1" });
}

function mockNoAllocation() {
  mocks.playerSquadMemberFindFirst.mockResolvedValue(null);
  mocks.trainerTeamMemberFindFirst.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTeamExists();
  mockNoSpecialRoles();
  mockPersonLinked();
  mockCurrentTeamSeason();
  mockNoAllocation();
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — resolveTeamDocumentAccess", () => {
  it("1. allocated to Team A => Team A documents ALLOWED", async () => {
    mockPlayerAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toMatchObject({
      canViewDocuments: true,
      canManageDocuments: false,
    });
  });

  it("2. allocated to Team A => Team B documents DENIED", async () => {
    mockPlayerAllocation();

    mocks.teamFindFirst.mockResolvedValueOnce(null);

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_B,
    });

    expect(access).toBeNull();
  });

  it("3. historical allocation only (no current season membership) => DENIED", async () => {
    mockNoAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toBeNull();
  });

  it("4. Club Admin own tenant => ALLOWED with manage", async () => {
    mockClubAdmin();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toMatchObject({
      canViewDocuments: true,
      canManageDocuments: true,
    });
  });

  it("6. SCE Superadmin => ALLOWED with manage", async () => {
    mockSuperAdmin();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toMatchObject({
      canViewDocuments: true,
      canManageDocuments: true,
    });
  });

  it("7. unallocated user with only teams.view semantics => DENIED", async () => {
    mockNoAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toBeNull();
  });

  it("8. unallocated user with teams.manage semantics (not Club Admin) => DENIED", async () => {
    mockNoAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toBeNull();
  });

  it("9. allocated player => view allowed, manage denied", async () => {
    mockPlayerAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access?.canViewDocuments).toBe(true);
    expect(access?.canManageDocuments).toBe(false);
  });

  it("10. allocated trainer => view and manage allowed", async () => {
    mockTrainerAllocation();

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access?.canViewDocuments).toBe(true);
    expect(access?.canManageDocuments).toBe(true);
  });

  it("denies when user has no linked Person in tenant", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const access = await resolveTeamDocumentAccess({
      userId: USER_ID,
      tenantId: TENANT_A,
      tenantKey: TENANT_KEY_A,
      teamId: TEAM_A,
    });

    expect(access).toBeNull();
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — resolvePersonCurrentTeamAllocation", () => {
  it("uses current active season team season only", async () => {
    mockPlayerAllocation();

    const allocation = await resolvePersonCurrentTeamAllocation(PERSON_ID, TEAM_A);

    expect(allocation).toEqual({
      isAllocated: true,
      isPlayer: true,
      isTrainer: false,
    });
    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: TEAM_A,
          season: { isActive: true },
        }),
      }),
    );
  });

  it("returns unallocated when team has no current season", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const allocation = await resolvePersonCurrentTeamAllocation(PERSON_ID, TEAM_A);

    expect(allocation).toEqual({
      isAllocated: false,
      isPlayer: false,
      isTrainer: false,
    });
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — requireTeamDocumentAccess", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getActiveTenant.mockResolvedValue({ id: TENANT_A, key: TENANT_KEY_A });
  });

  it("page protected: redirects unauthenticated users", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(requireTeamDocumentAccess(TEAM_A)).rejects.toThrow("REDIRECT");
  });

  it("page protected: notFound when access denied", async () => {
    mockNoAllocation();

    await expect(requireTeamDocumentAccess(TEAM_A)).rejects.toThrow("NOT_FOUND");
  });

  it("page protected: returns access when allowed", async () => {
    mockPlayerAllocation();

    const access = await requireTeamDocumentAccess(TEAM_A);
    expect(access.canViewDocuments).toBe(true);
  });
});

describe("TEAM-COCKPIT-PREMIUM-01J-C — requireApiTeamDocumentAccess", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({
      user: { id: USER_ID, activeTenantId: TENANT_A },
    });
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_A, key: TENANT_KEY_A });
  });

  it("list protected: 401 without session", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await requireApiTeamDocumentAccess(TEAM_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("list protected: 404 when view denied (non-enumerable)", async () => {
    mockNoAllocation();

    const result = await requireApiTeamDocumentAccess(TEAM_A);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toBe("Team nicht gefunden.");
    }
  });

  it("download protected: 404 without team access", async () => {
    mockNoAllocation();

    const result = await requireApiTeamDocumentAccess(TEAM_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("mutation protected: 403 for allocated player", async () => {
    mockPlayerAllocation();

    const result = await requireApiTeamDocumentAccess(TEAM_A, { requireManage: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("mutation protected: allowed for allocated trainer", async () => {
    mockTrainerAllocation();

    const result = await requireApiTeamDocumentAccess(TEAM_A, { requireManage: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.access.canManageDocuments).toBe(true);
  });

  it("5. Club Admin Tenant A cannot access Tenant B team via active tenant mismatch", async () => {
    mockClubAdmin();
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_B, key: TENANT_KEY_B });
    mocks.auth.mockResolvedValue({
      user: { id: USER_ID, activeTenantId: TENANT_B },
    });
    mocks.teamFindFirst.mockResolvedValue(null);

    const result = await requireApiTeamDocumentAccess(TEAM_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});
