/**
 * app/api/teams/[teamId]/team-seasons/[teamSeasonId]/competition/__tests__/route.test.ts
 *
 * TEAMCENTER-UX-01C — Focused tests for
 * PATCH /api/teams/[teamId]/team-seasons/[teamSeasonId]/competition.
 *
 * The route is a thin wrapper around setTeamSeasonCompetition() (mocked
 * here) — its own business rules are covered by
 * lib/teams/__tests__/team-season-competition.test.ts. These tests only
 * cover the HTTP surface: permission gating, request parsing, error-code to
 * status-code mapping, audit logging, and the success response shape.
 *
 * All database/service/permission access is mocked. No live database.
 *
 * TEST COVERAGE MAP:
 *   1. Requires TEAMS_MANAGE — 403 when the caller lacks permission.
 *   2. Passes the parsed competitionId + trusted tenantId/teamId/teamSeasonId
 *      through to the service (never trusts a client-supplied tenantId).
 *   3. Normalizes an empty-string/omitted competitionId to null (clears).
 *   4. Returns 200 with the updated competition on success.
 *   5. Maps TEAM_SEASON_NOT_FOUND to 404.
 *   6. Maps COMPETITION_NOT_ALLOWED to 400.
 *   7. Maps COMPETITION_ARCHIVED to 409.
 *   8. Writes an audit log entry on success.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  logAction: vi.fn(),
  setTeamSeasonCompetition: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/teams/team-season-service", () => ({
  setTeamSeasonCompetition: mocks.setTeamSeasonCompetition,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { PATCH } from "../route";

const TEAM_ID = "team-01";
const TEAM_SEASON_ID = "ts-01";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/teams/${TEAM_ID}/team-seasons/${TEAM_SEASON_ID}/competition`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeContext() {
  return { params: Promise.resolve({ teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID }) };
}

function makeSessionOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-01", activeTenantId: "tenant-a" } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue(makeSessionOk());
  mocks.getTenantFromSession.mockResolvedValue({ id: "tenant-a", key: "fc-test" });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.setTeamSeasonCompetition.mockResolvedValue({
    ok: true,
    competition: { id: "comp-01", officialName: "Liga 1", shortName: "L1" },
  });
});

describe("PATCH .../competition — permission gating", () => {
  it("1 — 403s and never calls the service when the caller lacks TEAMS_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.setTeamSeasonCompetition).not.toHaveBeenCalled();
  });
});

describe("PATCH .../competition — request handling", () => {
  it("2 — passes the trusted session tenantId (not client input) plus path params to the service", async () => {
    await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(mocks.setTeamSeasonCompetition).toHaveBeenCalledWith({
      tenantId: "tenant-a",
      teamId: TEAM_ID,
      teamSeasonId: TEAM_SEASON_ID,
      competitionId: "comp-01",
    });
  });

  it("3 — normalizes an empty-string competitionId to null (clears the assignment)", async () => {
    mocks.setTeamSeasonCompetition.mockResolvedValueOnce({ ok: true, competition: null });

    await PATCH(makeRequest({ competitionId: "" }), makeContext());

    expect(mocks.setTeamSeasonCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ competitionId: null }),
    );
  });

  it("3b — normalizes an omitted competitionId to null", async () => {
    mocks.setTeamSeasonCompetition.mockResolvedValueOnce({ ok: true, competition: null });

    await PATCH(makeRequest({}), makeContext());

    expect(mocks.setTeamSeasonCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ competitionId: null }),
    );
  });

  it("4 — returns 200 with the updated competition on success", async () => {
    const response = await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.competition).toEqual({ id: "comp-01", officialName: "Liga 1", shortName: "L1" });
  });

  it("8 — writes an audit log entry on success", async () => {
    await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: "teams",
        entityType: "TeamSeasonCompetition",
        entityId: TEAM_SEASON_ID,
        action: "UPDATE",
        afterJson: expect.objectContaining({
          teamId: TEAM_ID,
          teamSeasonId: TEAM_SEASON_ID,
          competitionId: "comp-01",
        }),
      }),
    );
  });
});

describe("PATCH .../competition — error-code to status mapping", () => {
  it("5 — TEAM_SEASON_NOT_FOUND -> 404", async () => {
    mocks.setTeamSeasonCompetition.mockResolvedValueOnce({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Team-Saison nicht gefunden.",
    });

    const response = await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.logAction).not.toHaveBeenCalled();
  });

  it("6 — COMPETITION_NOT_ALLOWED -> 400", async () => {
    mocks.setTeamSeasonCompetition.mockResolvedValueOnce({
      ok: false,
      code: "COMPETITION_NOT_ALLOWED",
      message: "Eine Wettkampfzuordnung ist nur für Wettkampfteams zulässig.",
    });

    const response = await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(response.status).toBe(400);
  });

  it("7 — COMPETITION_ARCHIVED -> 409", async () => {
    mocks.setTeamSeasonCompetition.mockResolvedValueOnce({
      ok: false,
      code: "COMPETITION_ARCHIVED",
      message: "Archivierte Wettkämpfe können nicht zugeordnet werden.",
    });

    const response = await PATCH(makeRequest({ competitionId: "comp-01" }), makeContext());

    expect(response.status).toBe(409);
  });
});
