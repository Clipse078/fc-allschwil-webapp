/**
 * app/api/teams/__tests__/route.test.ts
 *
 * TEAM-IDENTITY-01 — Focused tests for the POST /api/teams naming fields
 * (shortName, alternativeName) on brand-new Team creation.
 *
 * All database and permission access is mocked. No live database access.
 *
 * TEST COVERAGE MAP:
 *   1. shortName and alternativeName are persisted on team.create when provided.
 *   2. shortName and alternativeName default to null when omitted.
 *   3. Empty-string shortName/alternativeName is normalized to null.
 *   4. audit log afterJson includes the new fields.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  getTenantFromSession: vi.fn(),
  logAction: vi.fn(),
  seasonFindUnique: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  teamFindMany: vi.fn(),
  teamFindUnique: vi.fn(),
  teamFindFirst: vi.fn(),
  teamCreate: vi.fn(),
  teamSeasonCreate: vi.fn(),
  teamUpdate: vi.fn(),
  orgUnitFindUnique: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/tenants/queries", () => ({
  getTenantFromSession: mocks.getTenantFromSession,
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: (...args: unknown[]) => mocks.seasonFindUnique(...args) },
    teamSeason: {
      findFirst: (...args: unknown[]) => mocks.teamSeasonFindFirst(...args),
      create: (...args: unknown[]) => mocks.teamSeasonCreate(...args),
    },
    team: {
      findMany: (...args: unknown[]) => mocks.teamFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.teamFindUnique(...args),
      findFirst: (...args: unknown[]) => mocks.teamFindFirst(...args),
      create: (...args: unknown[]) => mocks.teamCreate(...args),
      update: (...args: unknown[]) => mocks.teamUpdate(...args),
    },
    orgUnit: {
      findUnique: (...args: unknown[]) => mocks.orgUnitFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/seasons/season-logic", () => ({
  getCurrentSwissFootballSeason: () => null,
}));

import { GET, POST } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost/api/teams";

const SEASON = {
  id: "season-2027",
  key: "2027",
  name: "2027/28",
  startDate: new Date("2027-07-01"),
  endDate: new Date("2028-06-30"),
  isActive: true,
};

const VALID_BODY = {
  name: "FC Allschwil Junioren B2",
  slug: "junioren-b2",
  category: "JUNIOREN",
  seasonId: SEASON.id,
  genderGroup: null,
  ageGroup: "B",
  sortOrder: 0,
  orgUnitId: null,
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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

beforeEach(() => {
  vi.clearAllMocks();

  mocks.requireApiPermission.mockResolvedValue(makeSessionOk());
  mocks.getTenantFromSession.mockResolvedValue({ id: "tenant-a", key: "fc-test" });
  mocks.seasonFindUnique.mockResolvedValue(SEASON);
  mocks.teamSeasonFindFirst.mockResolvedValue(null);
  mocks.teamFindUnique.mockResolvedValue(null);
  mocks.teamFindFirst.mockResolvedValue(null);
  mocks.teamCreate.mockResolvedValue({
    id: "team-new-01",
    name: VALID_BODY.name,
  });
  mocks.teamSeasonCreate.mockResolvedValue({ id: "ts-new-01" });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("POST /api/teams — TEAM-IDENTITY-01 naming fields", () => {
  it("1 — persists shortName and alternativeName on team.create when provided", async () => {
    await POST(makeRequest({ ...VALID_BODY, shortName: "B2", alternativeName: "Junioren B2" }));

    const createArgs = mocks.teamCreate.mock.calls[0][0];
    expect(createArgs.data.shortName).toBe("B2");
    expect(createArgs.data.alternativeName).toBe("Junioren B2");
  });

  it("2 — shortName and alternativeName default to null when omitted (long name still works)", async () => {
    await POST(makeRequest(VALID_BODY));

    const createArgs = mocks.teamCreate.mock.calls[0][0];
    expect(createArgs.data.name).toBe("FC Allschwil Junioren B2");
    expect(createArgs.data.shortName).toBeNull();
    expect(createArgs.data.alternativeName).toBeNull();
  });

  it("3 — empty-string shortName/alternativeName is normalized to null", async () => {
    await POST(makeRequest({ ...VALID_BODY, shortName: "", alternativeName: "   " }));

    const createArgs = mocks.teamCreate.mock.calls[0][0];
    expect(createArgs.data.shortName).toBeNull();
    expect(createArgs.data.alternativeName).toBeNull();
  });

  it("4 — audit log afterJson includes shortName and alternativeName", async () => {
    await POST(makeRequest({ ...VALID_BODY, shortName: "B2", alternativeName: "Junioren B2" }));

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        afterJson: expect.objectContaining({
          shortName: "B2",
          alternativeName: "Junioren B2",
        }),
      }),
    );
  });

  it("5 — manual team creation (no provider) still succeeds with the new fields", async () => {
    const response = await POST(
      makeRequest({ ...VALID_BODY, shortName: "B2", alternativeName: "Junioren B2" }),
    );
    expect(response.status).toBe(201);
    expect(mocks.teamCreate).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/teams — tenant isolation", () => {
  it("6 — assigns the caller's active tenantId to the newly created Team", async () => {
    await POST(makeRequest(VALID_BODY));

    const createArgs = mocks.teamCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe("tenant-a");
  });

  it("7 — scopes duplicate-name/slug lookups to the caller's active tenant", async () => {
    await POST(makeRequest(VALID_BODY));

    expect(mocks.teamSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          team: expect.objectContaining({ tenantId: "tenant-a" }),
        }),
      }),
    );
    expect(mocks.teamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-a" }) }),
    );
  });

  it("8 — rejects an orgUnitId belonging to a different tenant (cross-tenant relationship assignment rejected)", async () => {
    mocks.orgUnitFindUnique.mockResolvedValueOnce({ id: "ou-1", tenantId: "tenant-other" });

    const response = await POST(makeRequest({ ...VALID_BODY, orgUnitId: "ou-1" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/aktiven Mandanten/);
    expect(mocks.teamCreate).not.toHaveBeenCalled();
  });
});

describe("GET /api/teams — tenant isolation", () => {
  it("9 — lists only Teams scoped to the caller's active tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValueOnce({
      ok: true as const,
      status: 200,
      error: null,
      session: { user: { id: "user-01", activeTenantId: "tenant-a" } },
    });
    mocks.teamFindMany.mockResolvedValueOnce([]);

    await GET();

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-a" } }),
    );
  });
});
