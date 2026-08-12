/**
 * WEBSITE-CONSUMERS-01C — Season Wochenplan (scope=season)
 *
 * Tests for GET /api/public/[tenant]/website/weekplan?scope=season
 *
 * Covers:
 *   1. scope=season returns data from the active season (not current week)
 *   2. Historical-season records are excluded (only active season key used)
 *   3. Hidden / non-wochenplanVisible records are excluded via surface filter
 *   4. Existing week-mode (scope omitted) behavior is unchanged
 *   5. Returns 404 when no active season exists
 *   6. Cross-tenant isolation is enforced
 *   7. publication is always null for scope=season
 *   8. Meta includes scope="season" and season info
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Event fixture factory ─────────────────────────────────────────────────────

function makeEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    title: "Training F1",
    description: null,
    location: null,
    type: "TRAINING",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date("2026-09-10T17:00:00.000Z"),
    endAt: new Date("2026-09-10T19:00:00.000Z"),
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    homeAway: null,
    resultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: true,
    trainingsplanVisible: false,
    teamPageVisible: false,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: {
      id: "season-active",
      key: "2026-27",
      name: "Saison 2026/27",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
      isActive: true,
    },
    team: {
      id: "team-f1",
      name: "FC Allschwil F1",
      slug: "f1",
      category: "AKTIVE",
      genderGroup: "MALE",
      ageGroup: null,
    },
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  seasonFindFirst: vi.fn(),
  wochenplanPlanFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
    season: { findFirst: mocks.seasonFindFirst },
    wochenplanPlan: { findFirst: mocks.wochenplanPlanFindFirst },
  },
}));

const { GET } = await import("../route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
};

const ACTIVE_SEASON = {
  key: "2026-27",
  name: "Saison 2026/27",
};

const BASE_URL = "http://localhost/api/public/fc-allschwil/website/weekplan";

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}${query ? "?" + query : ""}`, { method: "GET" });
}

function makeParams(slug = "fc-allschwil") {
  return { params: Promise.resolve({ tenant: slug }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/weekplan?scope=season", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.seasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.wochenplanPlanFindFirst.mockResolvedValue(null);
  });

  // 1. Returns 200 for valid scope=season
  it("returns 200 for scope=season with active season", async () => {
    const res = await GET(makeRequest("scope=season"), makeParams());
    expect(res.status).toBe(200);
  });

  // 2. Active season key is used as season filter in DB query
  it("passes active season key to DB query when scope=season", async () => {
    await GET(makeRequest("scope=season"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.season).toEqual({ key: "2026-27" });
  });

  // 3. Historical-season records excluded — only active season key is passed
  it("does not use any other season key when scope=season", async () => {
    // Even if seasonKey param is present, scope=season overrides it
    await GET(makeRequest("scope=season&seasonKey=2024-25"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.season).toEqual({ key: "2026-27" });
    // The older season key must not appear
    expect(JSON.stringify(call.where)).not.toContain("2024-25");
  });

  // 4. wochenplanVisible filter is enforced (surface=wochenplan)
  it("enforces wochenplanVisible=true and websiteVisible=true via surface filter", async () => {
    await GET(makeRequest("scope=season"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.websiteVisible).toBe(true);
    expect(call.where.wochenplanVisible).toBe(true);
  });

  // 5. Returns events from the active season
  it("returns events from the active season in data.days", async () => {
    mocks.eventFindMany.mockResolvedValue([makeEventRow()]);
    const res = await GET(makeRequest("scope=season"), makeParams());
    const body = await res.json();
    expect(body.data.days).toHaveLength(1);
    expect(body.data.days[0].events).toHaveLength(1);
    expect(body.data.days[0].events[0].season.key).toBe("2026-27");
  });

  // 6. publication is always null for scope=season
  it("publication is null for scope=season", async () => {
    mocks.eventFindMany.mockResolvedValue([makeEventRow()]);
    const res = await GET(makeRequest("scope=season"), makeParams());
    const body = await res.json();
    expect(body.data.publication).toBeNull();
  });

  // 7. Meta includes scope=season and active season info
  it("meta.scope is 'season' and meta.season contains the active season", async () => {
    const res = await GET(makeRequest("scope=season"), makeParams());
    const body = await res.json();
    expect(body.meta.scope).toBe("season");
    expect(body.meta.season).toEqual({ key: "2026-27", name: "Saison 2026/27" });
  });

  // 8. Returns 404 when no active season exists
  it("returns 404 when no active season is found", async () => {
    mocks.seasonFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest("scope=season"), makeParams());
    expect(res.status).toBe(404);
  });

  // 9. Tenant isolation is enforced in DB query
  it("enforces tenant isolation in DB query", async () => {
    await GET(makeRequest("scope=season"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  // 10. Cross-tenant data cannot appear
  it("cross-tenant data cannot appear — tenantId is scoped to resolved tenant", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await GET(makeRequest("scope=season"), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  // 11. dateFrom/dateTo params are ignored for scope=season
  it("dateFrom and dateTo are not passed to DB when scope=season", async () => {
    await GET(makeRequest("scope=season&dateFrom=2026-08-01&dateTo=2026-08-31"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("startAt");
  });

  // 12. teamSlug filter is still respected in scope=season
  it("teamSlug filter is applied within scope=season", async () => {
    await GET(makeRequest("scope=season&teamSlug=f1"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.team).toEqual({ slug: "f1" });
  });

  // 13. Returns 404 for unknown tenant
  it("returns 404 for unknown tenant slug", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest("scope=season"), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  // 14. Returns 403 when website is not enabled
  it("returns 403 when website integration is disabled", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ ...ACTIVE_TENANT, websiteEnabled: false });
    const res = await GET(makeRequest("scope=season"), makeParams());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/public/[tenant]/website/weekplan (week mode — unchanged behavior)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.seasonFindFirst.mockResolvedValue(null);
    mocks.wochenplanPlanFindFirst.mockResolvedValue(null);
  });

  it("returns 200 without scope param (default week mode)", async () => {
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
  });

  it("does NOT call season.findFirst when scope is not 'season'", async () => {
    await GET(makeRequest(), makeParams());
    expect(mocks.seasonFindFirst).not.toHaveBeenCalled();
  });

  it("meta.scope is 'week' in default mode", async () => {
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.meta.scope).toBe("week");
  });

  it("meta.filters is present in default mode", async () => {
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.meta).toHaveProperty("filters");
  });

  it("responds with data.days and data.publication in default mode", async () => {
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data).toHaveProperty("days");
    expect(body.data).toHaveProperty("publication");
  });

  it("passes explicit seasonKey from query param in week mode", async () => {
    await GET(makeRequest("seasonKey=2025-26"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.season).toEqual({ key: "2025-26" });
  });

  it("does not query season.findFirst for non-season scopes", async () => {
    await GET(makeRequest("scope=week"), makeParams());
    expect(mocks.seasonFindFirst).not.toHaveBeenCalled();
  });
});
