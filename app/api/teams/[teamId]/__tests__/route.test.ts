/**
 * app/api/teams/[teamId]/__tests__/route.test.ts
 *
 * TEAM-IDENTITY-01 — Focused tests for the PATCH /api/teams/[teamId] naming
 * fields (shortName, alternativeName). Existing behavior (name, category,
 * genderGroup, ageGroup, sortOrder, orgUnitId, visibility flags) is
 * exercised only insofar as it interacts with the new fields.
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
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  logAction: vi.fn(),
  teamFindUnique: vi.fn(),
  teamUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findUnique: (...args: unknown[]) => mocks.teamFindUnique(...args),
      update: (...args: unknown[]) => mocks.teamUpdate(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: vi.fn().mockResolvedValue(null),
}));

import { PATCH } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEAM_ID = "team-b2";

const EXISTING_TEAM = {
  id: TEAM_ID,
  name: "FC Allschwil Junioren B2",
  shortName: null,
  alternativeName: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeSessionOk());
  mocks.teamFindUnique.mockResolvedValue(EXISTING_TEAM);
  mocks.logAction.mockResolvedValue(undefined);
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

  it("never sends a request that touches provider-owned TeamExternalMapping fields", async () => {
    mocks.teamUpdate.mockResolvedValueOnce({ ...EXISTING_TEAM, teamSeasons: [] });

    await PATCH(makeRequest({ ...BASE_BODY, shortName: "B2" }), makeContext());

    const updateArgs = mocks.teamUpdate.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty("providerTeamName");
  });
});
