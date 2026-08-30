import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  updateTeamSeasonPublication: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));
vi.mock("@/lib/teams/team-season-service", () => ({
  updateTeamSeasonPublication: mocks.updateTeamSeasonPublication,
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { PATCH } from "../route";

const context = {
  params: Promise.resolve({ teamId: "team-a", teamSeasonId: "season-a" }),
};

function request(body: unknown) {
  return new NextRequest(
    "http://localhost/api/teams/team-a/team-seasons/season-a/publication",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: { id: "user-a", activeTenantId: "tenant-a" },
    },
  });
  mocks.getTenantFromSession.mockResolvedValue({
    id: "tenant-a",
    key: "club-a",
  });
  mocks.updateTeamSeasonPublication.mockResolvedValue({
    ok: true,
    before: { showNextMatch: true, showNextTournament: false },
    publication: { showNextMatch: false, showNextTournament: false },
  });
});

describe("PATCH TeamSeason publication", () => {
  it("allows teams.manage and derives the tenant server-side", async () => {
    const response = await PATCH(request({ showNextMatch: false }), context);

    expect(response.status).toBe(200);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("teams.manage");
    expect(mocks.updateTeamSeasonPublication).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
    });
  });

  it("rejects unauthenticated callers", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await PATCH(request({ showNextMatch: false }), context);

    expect(response.status).toBe(401);
    expect(mocks.updateTeamSeasonPublication).not.toHaveBeenCalled();
  });

  it("rejects callers without teams.manage", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await PATCH(request({ showNextTournament: true }), context);

    expect(response.status).toBe(403);
    expect(mocks.updateTeamSeasonPublication).not.toHaveBeenCalled();
  });

  it("supports changing only showNextTournament", async () => {
    await PATCH(request({ showNextTournament: true }), context);

    expect(mocks.updateTeamSeasonPublication).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextTournament: true,
    });
  });

  it("preserves explicit false when tournament-only OFF/ON is saved together", async () => {
    mocks.updateTeamSeasonPublication.mockResolvedValueOnce({
      ok: true,
      before: { showNextMatch: true, showNextTournament: false },
      publication: { showNextMatch: false, showNextTournament: true },
    });

    const response = await PATCH(
      request({ showNextMatch: false, showNextTournament: true }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateTeamSeasonPublication).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamId: "team-a",
      teamSeasonId: "season-a",
      showNextMatch: false,
      showNextTournament: true,
    });
    expect(body.publication).toEqual({
      showNextMatch: false,
      showNextTournament: true,
    });
  });

  it("rejects invalid or empty publication payloads", async () => {
    const wrongType = await PATCH(request({ showNextMatch: "yes" }), context);
    const empty = await PATCH(request({}), context);

    expect(wrongType.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(mocks.updateTeamSeasonPublication).not.toHaveBeenCalled();
  });

  it("maps cross-tenant and mismatched ownership failures", async () => {
    mocks.updateTeamSeasonPublication.mockResolvedValueOnce({
      ok: false,
      code: "TEAM_SEASON_TENANT_MISMATCH",
      message: "Wrong tenant",
    });
    const crossTenant = await PATCH(
      request({ showNextTournament: true }),
      context,
    );

    mocks.updateTeamSeasonPublication.mockResolvedValueOnce({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Not found",
    });
    const mismatchedTeam = await PATCH(
      request({ showNextTournament: true }),
      context,
    );

    expect(crossTenant.status).toBe(403);
    expect(mismatchedTeam.status).toBe(404);
  });
});
