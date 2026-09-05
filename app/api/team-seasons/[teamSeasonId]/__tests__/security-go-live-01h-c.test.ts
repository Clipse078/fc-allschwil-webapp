import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  teamSeasonUpdate: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    teamSeason: {
      findFirst: mocks.teamSeasonFindFirst,
      update: mocks.teamSeasonUpdate,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import { PATCH } from "../route";

const TENANT_A = "tenant-a";

function request() {
  return new Request("http://localhost/api/team-seasons/team-season-a", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: "Team A 2026/27",
      status: "ACTIVE",
      websiteVisible: true,
      infoboardVisible: true,
    }),
  });
}

function context(teamSeasonId = "team-season-a") {
  return { params: Promise.resolve({ teamSeasonId }) };
}

const TEAM_SEASON = {
  id: "team-season-a",
  teamId: "team-a",
  seasonId: "season-1",
  displayName: "Team A",
  shortName: null,
  status: "ACTIVE",
  websiteVisible: true,
  infoboardVisible: true,
  season: { id: "season-1", name: "2026/27" },
  team: { id: "team-a", name: "Team A" },
};

describe("SECURITY-GO-LIVE-01H-C — TeamSeason object isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: TENANT_A } },
    });
    mocks.teamSeasonFindFirst.mockResolvedValue(TEAM_SEASON);
    mocks.teamSeasonUpdate.mockResolvedValue({
      ...TEAM_SEASON,
      displayName: "Team A 2026/27",
    });
  });

  it("mutates an own-tenant TeamSeason with teams.manage", async () => {
    const response = await PATCH(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-season-a", team: { tenantId: TENANT_A } },
      }),
    );
    expect(mocks.teamSeasonUpdate).toHaveBeenCalledOnce();
  });

  it("rejects a Tenant B TeamSeason for a Tenant A caller", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const response = await PATCH(request(), context("team-season-b"));

    expect(response.status).toBe(404);
    expect(mocks.teamSeasonUpdate).not.toHaveBeenCalled();
  });

  it("uses the same safe response for a nonexistent TeamSeason", async () => {
    mocks.teamSeasonFindFirst.mockResolvedValue(null);

    const response = await PATCH(request(), context("missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Team Season nicht gefunden.",
    });
    expect(mocks.teamSeasonUpdate).not.toHaveBeenCalled();
  });

  it("fails closed without an active tenant membership context", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      session: { user: { id: "user-a", activeTenantId: null } },
    });

    const response = await PATCH(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.teamSeasonFindFirst).not.toHaveBeenCalled();
  });

  it("preserves the teams.manage permission gate", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await PATCH(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.teamSeasonFindFirst).not.toHaveBeenCalled();
  });
});
