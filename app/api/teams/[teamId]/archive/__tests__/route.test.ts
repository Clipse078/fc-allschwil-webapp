/**
 * app/api/teams/[teamId]/archive/__tests__/route.test.ts
 *
 * TEAMCENTER-UX-01 — Focused tests for POST /api/teams/[teamId]/archive.
 *
 * All database, permission, and tenant resolution is mocked. No live DB.
 *
 * TEST COVERAGE MAP:
 *   1. Archives the Team scoped to the caller's active tenant (TEAMS_MANAGE).
 *   2. Rejected (403) when the caller lacks TEAMS_MANAGE (VIEW-only).
 *   3. 404 when the Team belongs to a different tenant (cross-tenant mutation blocked).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  logAction: vi.fn(),
  archiveTeam: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/teams/team-lifecycle-service", () => ({
  TeamNotFoundError: class TeamNotFoundError extends Error {},
  archiveTeam: mocks.archiveTeam,
}));

import { POST } from "../route";

const TEAM_ID = "team-b2";

function makeContext() {
  return { params: Promise.resolve({ teamId: TEAM_ID }) };
}

function makeRequest() {
  return new NextRequest(`http://localhost/api/teams/${TEAM_ID}/archive`, { method: "POST" });
}

function sessionOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-01", activeTenantId: "tenant-a" } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantFromSession.mockResolvedValue({ id: "tenant-a", key: "fc-test" });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("POST /api/teams/[teamId]/archive", () => {
  it("1 — archives the Team for TEAMS_MANAGE callers", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(sessionOk());
    mocks.archiveTeam.mockResolvedValueOnce({ id: TEAM_ID, isActive: false });

    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.archiveTeam).toHaveBeenCalledWith("tenant-a", TEAM_ID);
    expect(body.team.isActive).toBe(false);
  });

  it("2 — VIEW-only callers are rejected with 403 (VIEW vs MANAGE)", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.archiveTeam).not.toHaveBeenCalled();
  });

  it("3 — cross-tenant Team returns 404, never archived", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(sessionOk());
    const { TeamNotFoundError } = await import("@/lib/teams/team-lifecycle-service");
    mocks.archiveTeam.mockRejectedValueOnce(new TeamNotFoundError());

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(404);
  });
});
