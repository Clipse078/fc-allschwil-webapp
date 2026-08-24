/**
 * app/api/teams/[teamId]/__tests__/route.test.ts
 *
 * TEAM-IDENTITY-01 — Focused tests for the PATCH /api/teams/[teamId] naming
 * fields (shortName, alternativeName). Existing behavior (name, category,
 * genderGroup, ageGroup, sortOrder, orgUnitId, visibility flags) is
 * exercised only insofar as it interacts with the new fields.
 *
 * ADMIN-DELETE-01B — Focused tests for the DELETE /api/teams/[teamId]
 * permanent-delete authorization rewire (PERMISSIONS.TEAMS_DELETE via
 * EffectivePermissionResolver.hasTenantDeletionAuthority(), never
 * TEAMS_MANAGE). The resolver's own Club Admin / SCE Super Admin /
 * delegated-user grant logic is exhaustively covered at the resolver level
 * (lib/permissions/__tests__/admin-delete-01a-c1-cross-tenant-super-admin-
 * authority.test.ts) — these tests instead verify the ROUTE wiring: the
 * target Team's tenant is resolved server-side (never from the client), the
 * resolver is invoked with that exact tenantId + PERMISSIONS.TEAMS_DELETE,
 * and the route's response follows the resolver's decision.
 *
 * All database and permission access is mocked. No live database access.
 *
 * TEST COVERAGE MAP:
 *   1. Omitting shortName/alternativeName from the body leaves them unchanged.
 *   2. shortName can be set to a new value.
 *   3. alternativeName can be set to a new value.
 *   4. shortName can be cleared by sending null.
 *   5. alternativeName can be cleared by sending an empty string.
 *   6. Blank/whitespace-only shortName is normalized to null.
 *   7. audit log afterJson includes the new fields.
 *
 *   OrgUnit assignment (Organisationseinheit relationship)
 *   16. A valid, same-tenant orgUnitId is persisted on team.update.
 *   17. A cross-tenant orgUnitId is rejected with 403 and never persisted.
 *
 *   DELETE — ADMIN-DELETE-01B authorization rewire
 *   18. Club Admin: allowed within their own tenant (resolver Path 1).
 *   19. Club Admin: denied for a Team in another tenant (resolver Path 1 false).
 *   20. SCE Super Admin: allowed for a Team in a different, ACTIVE tenant
 *       (resolver Path 2) — the route never restricts the lookup to the
 *       caller's own session tenant.
 *   21. Delegated user holding only teams.delete: allowed within the tenant
 *       where that permission was granted.
 *   22. teams.manage-only (no teams.delete): denied — resolver returns false,
 *       route never falls back to a TEAMS_MANAGE check.
 *   23. A client-supplied tenantId (query string) is ignored — the resolver
 *       is always called with the Team's own DB-resolved tenantId.
 *   24. 409 with blockers when the Team has meaningful history (unchanged
 *       deletion-safety behavior).
 *   25. 404 when the Team does not exist.
 *   26. 401 when there is no session.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  teamFindUnique: vi.fn(),
  teamUpdate: vi.fn(),
  archiveTeam: vi.fn(),
  restoreTeam: vi.fn(),
  deleteTeamSafely: vi.fn(),
  orgUnitFindUnique: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findUnique: (...args: unknown[]) => mocks.teamFindUnique(...args),
      findFirst: (...args: unknown[]) => mocks.teamFindUnique(...args),
      update: (...args: unknown[]) => mocks.teamUpdate(...args),
    },
    orgUnit: {
      findUnique: (...args: unknown[]) => mocks.orgUnitFindUnique(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-test" }),
}));

vi.mock("@/lib/teams/team-lifecycle-service", () => ({
  archiveTeam: mocks.archiveTeam,
  restoreTeam: mocks.restoreTeam,
  deleteTeamSafely: mocks.deleteTeamSafely,
  TeamNotFoundError: class TeamNotFoundError extends Error {},
  TeamDeletionBlockedError: class TeamDeletionBlockedError extends Error {
    blockers: unknown[];
    constructor(blockers: unknown[] = []) {
      super("blocked");
      this.blockers = blockers;
    }
  },
}));

import { DELETE, GET, PATCH } from "../route";
import {
  TeamDeletionBlockedError as MockedTeamDeletionBlockedError,
  TeamNotFoundError as MockedTeamNotFoundError,
} from "@/lib/teams/team-lifecycle-service";

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEAM_ID = "team-b2";

const EXISTING_TEAM = {
  id: TEAM_ID,
  name: "FC Allschwil Junioren B2",
  shortName: null,
  alternativeName: null,
  infoboardDisplayName: null,
  infoboardTrainingDisplayName: null,
  infoboardMatchDisplayName: null,
  infoboardTournamentDisplayName: null,
  slug: "junioren-b2",
  category: "JUNIOREN",
  genderGroup: null,
  ageGroup: "B",
  sortOrder: 0,
  isActive: true,
  websiteVisible: true,
  infoboardVisible: true,
  orgUnitId: null,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/teams/${TEAM_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext() {
  return { params: Promise.resolve({ teamId: TEAM_ID }) };
}

function makeSessionOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: {
      user: { id: "user-01", activeTenantId: "tenant-a" },
    },
  };
}

const BASE_BODY = {
  name: "FC Allschwil Junioren B2",
  category: "JUNIOREN",
  genderGroup: null,
  ageGroup: "B",
  sortOrder: 0,
  isActive: true,
  websiteVisible: true,
  infoboardVisible: true,
};

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeSessionOk());
  mocks.teamFindUnique.mockResolvedValue(EXISTING_TEAM);
  mocks.logAction.mockResolvedValue(undefined);
  mocks.auth.mockResolvedValue(makeAuthSession());
});

describe("PATCH /api/teams/[teamId] — TEAM-IDENTITY-01 naming fields", () => {
  it("1 — omitting shortName/alternativeName leaves them unchanged (no keys in update data)", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, teamSeasons: [] });

    const response = await PATCH(makeRequest(BASE_BODY), makeContext());
    expect(response.status).toBe(200);

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("shortName");
    expect(updateArgs.data).not.toHaveProperty("alternativeName");
  });

  it("2 — shortName can be set to a new value", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, shortName: "B2", teamSeasons: [] });

    await PATCH(makeRequest({ ...BASE_BODY, shortName: "B2" }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.shortName).toBe("B2");
  });

  it("3 — alternativeName can be set to a new value", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      alternativeName: "Junioren B2",
      teamSeasons: [],
    });

    await PATCH(makeRequest({ ...BASE_BODY, alternativeName: "Junioren B2" }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.alternativeName).toBe("Junioren B2");
  });

  it("4 — shortName can be cleared by sending null", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ ...EXISTING_TEAM, shortName: "B2" });
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, shortName: null, teamSeasons: [] });

    await PATCH(makeRequest({ ...BASE_BODY, shortName: null }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.shortName).toBeNull();
  });

  it("5 — alternativeName can be cleared by sending an empty string", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ ...EXISTING_TEAM, alternativeName: "Junioren B2" });
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      alternativeName: null,
      teamSeasons: [],
    });

    await PATCH(makeRequest({ ...BASE_BODY, alternativeName: "" }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.alternativeName).toBeNull();
  });

  it("6 — blank/whitespace-only shortName is normalized to null, not saved verbatim", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, shortName: null, teamSeasons: [] });

    await PATCH(makeRequest({ ...BASE_BODY, shortName: "   " }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.shortName).toBeNull();
  });

  it("7 — audit log afterJson includes shortName and alternativeName", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      shortName: "B2",
      alternativeName: "Junioren B2",
      teamSeasons: [],
    });

    await PATCH(
      makeRequest({ ...BASE_BODY, shortName: "B2", alternativeName: "Junioren B2" }),
      makeContext(),
    );

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        afterJson: expect.objectContaining({
          shortName: "B2",
          alternativeName: "Junioren B2",
        }),
      }),
    );
  });

  it("8 — infoboardDisplayName can be set and trimmed", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      infoboardDisplayName: "JUNIOREN E4",
      teamSeasons: [],
    });

    await PATCH(
      makeRequest({ ...BASE_BODY, infoboardDisplayName: "  JUNIOREN E4  " }),
      makeContext(),
    );

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.infoboardDisplayName).toBe("JUNIOREN E4");
  });

  it("9 — blank infoboardDisplayName is normalized to null", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      infoboardDisplayName: "JUNIOREN E4",
    });
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      infoboardDisplayName: null,
      teamSeasons: [],
    });

    await PATCH(makeRequest({ ...BASE_BODY, infoboardDisplayName: "   " }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.infoboardDisplayName).toBeNull();
  });

  it("10 — canonical Team fields remain unchanged when only infoboardDisplayName is updated", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      name: "E4",
      shortName: "E4",
      alternativeName: "Junioren E4",
    });
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      name: "E4",
      shortName: "E4",
      alternativeName: "Junioren E4",
      infoboardDisplayName: "JUNIOREN E4",
      teamSeasons: [],
    });

    await PATCH(
      makeRequest({
        ...BASE_BODY,
        name: "E4",
        shortName: "E4",
        alternativeName: "Junioren E4",
        infoboardDisplayName: "JUNIOREN E4",
      }),
      makeContext(),
    );

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.name).toBe("E4");
    expect(updateArgs.data.shortName).toBe("E4");
    expect(updateArgs.data.alternativeName).toBe("Junioren E4");
    expect(updateArgs.data.infoboardDisplayName).toBe("JUNIOREN E4");
  });

  it("12 — card-specific infoboard display names can be set and trimmed", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({
      ...EXISTING_TEAM,
      infoboardTrainingDisplayName: "Junioren E1",
      infoboardMatchDisplayName: "FC Allschwil E1",
      infoboardTournamentDisplayName: "FCA E1",
      teamSeasons: [],
    });

    await PATCH(
      makeRequest({
        ...BASE_BODY,
        infoboardTrainingDisplayName: "  Junioren E1  ",
        infoboardMatchDisplayName: " FC Allschwil E1 ",
        infoboardTournamentDisplayName: " FCA E1 ",
      }),
      makeContext(),
    );

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.infoboardTrainingDisplayName).toBe("Junioren E1");
    expect(updateArgs.data.infoboardMatchDisplayName).toBe("FC Allschwil E1");
    expect(updateArgs.data.infoboardTournamentDisplayName).toBe("FCA E1");
  });

  it("11 — rejects infoboardDisplayName longer than 120 characters", async () => {
    const response = await PATCH(
      makeRequest({ ...BASE_BODY, infoboardDisplayName: "X".repeat(121) }),
      makeContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });

  it("never sends a request that touches provider-owned TeamExternalMapping fields", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, teamSeasons: [] });

    await PATCH(makeRequest({ ...BASE_BODY, shortName: "B2" }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("providerTeamName");
  });

  it("16 — a valid, same-tenant orgUnitId (Organisationseinheit) is persisted on team.update", async () => {
    mocks.orgUnitFindUnique.mockResolvedValueOnce({ id: "ou-1", tenantId: "tenant-a" });
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, orgUnitId: "ou-1", teamSeasons: [] });

    const response = await PATCH(makeRequest({ ...BASE_BODY, orgUnitId: "ou-1" }), makeContext());

    expect(response.status).toBe(200);
    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.orgUnitId).toBe("ou-1");
  });

  it("17 — a cross-tenant orgUnitId is rejected with 403 and never persisted", async () => {
    mocks.orgUnitFindUnique.mockResolvedValueOnce({ id: "ou-1", tenantId: "tenant-other" });

    const response = await PATCH(makeRequest({ ...BASE_BODY, orgUnitId: "ou-1" }), makeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/aktiven Mandanten/);
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });

  it("8 — omitting isActive preserves the existing archive state (no silent archive on plain save)", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ ...EXISTING_TEAM, isActive: true });
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, teamSeasons: [] });

    const bodyWithoutIsActive: Partial<typeof BASE_BODY> = { ...BASE_BODY };
    delete bodyWithoutIsActive.isActive;
    await PATCH(makeRequest(bodyWithoutIsActive), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data.isActive).toBe(true);
  });
});

describe("GET /api/teams/[teamId] — tenant isolation", () => {
  it("9 — scopes the lookup to the caller's active tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce(makeSessionOk());
    mocks.teamFindUnique.mockResolvedValueOnce({ ...EXISTING_TEAM, teamSeasons: [] });

    await GET(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(mocks.teamFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEAM_ID, tenantId: "tenant-a" } }),
    );
  });

  it("10 — returns 404 (not the other tenant's Team) when scoped lookup finds nothing", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce(makeSessionOk());
    mocks.teamFindUnique.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/teams/[teamId] — cross-tenant mutation blocked", () => {
  it("11 — 404s instead of updating when the Team belongs to another tenant", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce(null);

    const response = await PATCH(makeRequest(BASE_BODY), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.teamUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/teams/[teamId] — ADMIN-DELETE-01B permanent-delete authorization", () => {
  const TENANT_A = "tenant-a"; // the Team's own tenant, resolved server-side
  const TENANT_B = "tenant-b"; // a different tenant

  it("18 — Club Admin: allowed within their own tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockResolvedValueOnce({ id: TEAM_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "teams.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteTeamSafely).toHaveBeenCalledWith(TENANT_A, TEAM_ID);
  });

  it("19 — Club Admin: denied for a Team belonging to another tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    // The Team actually belongs to tenant-b — a Club Admin whose grant is
    // scoped to tenant-a must not be authorized here.
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "teams.delete",
      tenantId: TENANT_B,
    });
    expect(mocks.deleteTeamSafely).not.toHaveBeenCalled();
  });

  it("20 — SCE Super Admin: allowed for a Team in a different, ACTIVE tenant", async () => {
    // The route never restricts the lookup to the caller's own session
    // tenant — the resolver's platform cross-tenant path (already unit
    // tested) is trusted via its return value here.
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockResolvedValueOnce({ id: TEAM_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "sce-super-admin-1",
      permission: "teams.delete",
      tenantId: TENANT_B,
    });
    expect(mocks.deleteTeamSafely).toHaveBeenCalledWith(TENANT_B, TEAM_ID);
  });

  it("21 — delegated user holding only teams.delete: allowed within the granted tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("delegated-user-1"));
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockResolvedValueOnce({ id: TEAM_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.deleteTeamSafely).toHaveBeenCalledWith(TENANT_A, TEAM_ID);
  });

  it("22 — teams.manage-only (no teams.delete): denied, never falls back to a MANAGE check", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "teams.delete" }),
    );
    expect(mocks.deleteTeamSafely).not.toHaveBeenCalled();
  });

  it("23 — a client-supplied tenantId (query string) is ignored; the Team's own DB tenantId is used", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockResolvedValueOnce({ id: TEAM_ID });

    // Attempt to smuggle a different tenantId via the query string.
    const response = await DELETE(
      new NextRequest(`http://localhost/api/teams/${TEAM_ID}?tenantId=${TENANT_B}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteTeamSafely).toHaveBeenCalledWith(TENANT_A, TEAM_ID);
  });

  it("24 — 409 with blockers when the Team has meaningful history (deletion-safety unchanged)", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockRejectedValueOnce(
      new MockedTeamDeletionBlockedError([{ key: "squad", label: "Kadermitglieder", count: 14 }]),
    );

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([{ key: "squad", label: "Kadermitglieder", count: 14 }]);
  });

  it("25 — 404 when the Team does not exist (never authorizes or deletes)", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteTeamSafely).not.toHaveBeenCalled();
  });

  it("25a — 404 when the Team has no owning tenant (Team.tenantId is nullable)", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: null });

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteTeamSafely).not.toHaveBeenCalled();
  });

  it("25b — 404 when the Team is deleted concurrently between authorization and the delete itself", async () => {
    mocks.teamFindUnique.mockResolvedValueOnce({ id: TEAM_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTeamSafely.mockRejectedValueOnce(new MockedTeamNotFoundError());

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(404);
  });

  it("26 — 401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(`http://localhost/api/teams/${TEAM_ID}`), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.teamFindUnique).not.toHaveBeenCalled();
    expect(mocks.deleteTeamSafely).not.toHaveBeenCalled();
  });
});
