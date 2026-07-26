/**
 * Tests for domain-specific public website feed endpoints:
 *   GET /api/public/[tenant]/website/club-events
 *   GET /api/public/[tenant]/website/tournaments
 *   GET /api/public/[tenant]/website/trainings
 *   GET /api/public/[tenant]/website/matches (DB-level type filter verification)
 *   GET /api/public/[tenant]/website/events  (compatibility contract)
 *
 * Covers:
 *   A. Club events — returns eligible club events; excludes MATCH, TOURNAMENT,
 *      TRAINING; tenant isolation enforced.
 *   B. Matches — returns only MATCH; filter applied at DB level.
 *   C. Tournaments — returns only TOURNAMENT; tenant isolation enforced.
 *   D. Trainings — returns only TRAINING; trainingsplanVisible enforced; tenant isolation.
 *   G. Compatibility — existing /website/events response contract remains valid.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Shared event fixture factory ───────────────────────────────────────────────

function makeEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    title: "Test Event",
    description: null,
    location: null,
    type: "OTHER",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date("2026-08-01T09:00:00.000Z"),
    endAt: null,
    opponentName: null,
    organizerName: null,
    competitionLabel: null,
    homeAway: null,
    resultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: false,
    homepageVisible: false,
    wochenplanVisible: false,
    trainingsplanVisible: false,
    teamPageVisible: false,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: { id: "s1", key: "2025-26", name: "Saison 2025/26", startDate: new Date("2025-07-01"), endDate: new Date("2026-06-30"), isActive: true },
    team: null,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
  },
}));

// Import route handlers after mocks are set up.
const { GET: getClubEvents } = await import("../club-events/route");
const { GET: getTournaments } = await import("../tournaments/route");
const { GET: getTrainings } = await import("../trainings/route");
const { GET: getMatches } = await import("../matches/route");
const { GET: getEvents } = await import("../events/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
};

const BASE_URL = "http://localhost/api/public/fc-allschwil/website";

function makeRequest(path = "", query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}${path}${query ? "?" + query : ""}`, {
    method: "GET",
  });
}

function makeParams(slug = "fc-allschwil") {
  return { params: Promise.resolve({ tenant: slug }) };
}

// ── A. Club Events ─────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/club-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 for a valid tenant", async () => {
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    expect(res.status).toBe(200);
  });

  it("response envelope contains data.clubEvents array", async () => {
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.clubEvents");
    expect(Array.isArray(body.data.clubEvents)).toBe(true);
  });

  it("response envelope contains tenant key", async () => {
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    const body = await res.json();
    expect(body.tenant.key).toBe("fc-allschwil");
  });

  it("applies DB-level type filter for OTHER only", async () => {
    await getClubEvents(makeRequest("/club-events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["OTHER"] });
  });

  it("MATCH events are excluded by type filter", async () => {
    await getClubEvents(makeRequest("/club-events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type.in).not.toContain("MATCH");
  });

  it("TOURNAMENT events are excluded by type filter", async () => {
    await getClubEvents(makeRequest("/club-events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type.in).not.toContain("TOURNAMENT");
  });

  it("TRAINING events are excluded by type filter", async () => {
    await getClubEvents(makeRequest("/club-events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type.in).not.toContain("TRAINING");
  });

  it("applies tenant isolation in the DB query", async () => {
    await getClubEvents(makeRequest("/club-events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("returns events from DB in response", async () => {
    mocks.eventFindMany.mockResolvedValue([makeEventRow({ type: "OTHER" })]);
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    const body = await res.json();
    expect(body.data.clubEvents).toHaveLength(1);
    expect(body.data.clubEvents[0].type).toBe("OTHER");
  });

  it("returns 404 when tenant is not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await getClubEvents(makeRequest("/club-events"), makeParams("unknown-slug"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when website is not enabled", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ ...ACTIVE_TENANT, websiteEnabled: false });
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    expect(res.status).toBe(403);
  });

  it("events from another tenant cannot appear (tenant isolation)", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    // The query must be scoped to the OTHER tenant's id, not tenant-fca
    await getClubEvents(makeRequest("/club-events"), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  it("does not expose internal pitchCode or dressingRoom fields", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeEventRow({ type: "OTHER", pitchCode: "P-1", homeDressingRoomCode: "DR-A" }),
    ]);
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    const body = await res.json();
    const item = body.data.clubEvents[0];
    expect(item).not.toHaveProperty("pitchCode");
    expect(item).not.toHaveProperty("homeDressingRoomCode");
    expect(item).not.toHaveProperty("awayDressingRoomCode");
  });

  it("500 response returns safe generic message — internal Prisma details not exposed", async () => {
    mocks.eventFindMany.mockRejectedValue(
      new Error("Unique constraint failed on field `Event.tenantId`"),
    );
    const res = await getClubEvents(makeRequest("/club-events"), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    // Internal Prisma details must NOT appear in the public HTTP response body.
    expect(JSON.stringify(body)).not.toMatch(/Unique constraint|Event\.tenantId/);
    expect(body.error).toMatch(/technischer Fehler/i);
  });
});

// ── B. Matches ─────────────────────────────────────────────────────────────────


describe("GET /api/public/[tenant]/website/matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 for a valid tenant", async () => {
    const res = await getMatches(makeRequest("/matches"), makeParams());
    expect(res.status).toBe(200);
  });

  it("DB-level type filter is applied for MATCH only", async () => {
    await getMatches(makeRequest("/matches"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["MATCH"] });
  });

  it("applies tenant isolation in the DB query", async () => {
    await getMatches(makeRequest("/matches"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("response envelope contains data.matches array", async () => {
    const res = await getMatches(makeRequest("/matches"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.matches");
    expect(Array.isArray(body.data.matches)).toBe(true);
  });

  it("returns MATCH events from DB", async () => {
    mocks.eventFindMany.mockResolvedValue([makeEventRow({ type: "MATCH", homeAway: "HOME" })]);
    const res = await getMatches(makeRequest("/matches"), makeParams());
    const body = await res.json();
    expect(body.data.matches).toHaveLength(1);
    expect(body.data.matches[0].type).toBe("MATCH");
  });
});

  it("matches 500 response: safe generic message, not internal error text", async () => {
    mocks.eventFindMany.mockRejectedValue(new Error("connection reset by peer at 10.0.0.1:5432"));
    const res = await getMatches(makeRequest("/matches"), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/10\.0\.0\.1|5432|connection reset/);
    expect(body.error).toMatch(/technischer Fehler/i);
  });

// ── C. Tournaments ─────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 for a valid tenant", async () => {
    const res = await getTournaments(makeRequest("/tournaments"), makeParams());
    expect(res.status).toBe(200);
  });

  it("DB-level type filter is applied for TOURNAMENT only", async () => {
    await getTournaments(makeRequest("/tournaments"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["TOURNAMENT"] });
  });

  it("non-TOURNAMENT event types are excluded by DB filter", async () => {
    await getTournaments(makeRequest("/tournaments"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type.in).not.toContain("MATCH");
    expect(call.where.type.in).not.toContain("TRAINING");
    expect(call.where.type.in).not.toContain("OTHER");
  });

  it("applies tenant isolation in the DB query", async () => {
    await getTournaments(makeRequest("/tournaments"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("response envelope contains data.tournaments array", async () => {
    const res = await getTournaments(makeRequest("/tournaments"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.tournaments");
    expect(Array.isArray(body.data.tournaments)).toBe(true);
  });

  it("returns 404 when tenant is not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await getTournaments(makeRequest("/tournaments"), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("events from another tenant cannot appear", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await getTournaments(makeRequest("/tournaments"), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
  });
});

  it("tournaments 500 response: safe generic message, not internal error text", async () => {
    mocks.eventFindMany.mockRejectedValue(new Error("Invalid value for argument `where`"));
    const res = await getTournaments(makeRequest("/tournaments"), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/Invalid value for argument/);
    expect(body.error).toMatch(/technischer Fehler/i);
  });

// ── D. Trainings ───────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/trainings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 for a valid tenant", async () => {
    const res = await getTrainings(makeRequest("/trainings"), makeParams());
    expect(res.status).toBe(200);
  });

  it("DB-level type filter is applied for TRAINING only", async () => {
    await getTrainings(makeRequest("/trainings"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["TRAINING"] });
  });

  it("trainingsplanVisible is enforced via DB query (trainingsplan surface)", async () => {
    await getTrainings(makeRequest("/trainings"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    // trainingsplan surface → websiteVisible + trainingsplanVisible must both be true
    expect(call.where.websiteVisible).toBe(true);
    expect(call.where.trainingsplanVisible).toBe(true);
  });

  it("applies tenant isolation in the DB query", async () => {
    await getTrainings(makeRequest("/trainings"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("response envelope contains data.trainings array", async () => {
    const res = await getTrainings(makeRequest("/trainings"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.trainings");
    expect(Array.isArray(body.data.trainings)).toBe(true);
  });

  it("returns 404 when tenant is not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await getTrainings(makeRequest("/trainings"), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("events from another tenant cannot appear", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await getTrainings(makeRequest("/trainings"), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  it("does not expose visibility or allocation fields", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeEventRow({ type: "TRAINING", trainingsplanVisible: true, websiteVisible: true }),
    ]);
    const res = await getTrainings(makeRequest("/trainings"), makeParams());
    const body = await res.json();
    const item = body.data.trainings[0];
    expect(item).not.toHaveProperty("trainingsplanVisible");
    expect(item).not.toHaveProperty("websiteVisible");
    expect(item).not.toHaveProperty("pitchCode");
  });
});

  it("trainings 500 response: safe generic message, not internal error text", async () => {
    mocks.eventFindMany.mockRejectedValue(new Error("PrismaClientKnownRequestError: table Event"));
    const res = await getTrainings(makeRequest("/trainings"), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/PrismaClientKnownRequestError|table Event/);
    expect(body.error).toMatch(/technischer Fehler/i);
  });

// ── G. Compatibility — /website/events ────────────────────────────────────────

describe("GET /api/public/[tenant]/website/events (compatibility contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns 200 with standard envelope shape", async () => {
    const res = await getEvents(makeRequest("/events"), makeParams());
    expect(res.status).toBe(200);
  });

  it("response contains data.events array", async () => {
    const res = await getEvents(makeRequest("/events"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.events");
    expect(Array.isArray(body.data.events)).toBe(true);
  });

  it("response contains version field", async () => {
    const res = await getEvents(makeRequest("/events"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("version");
  });

  it("response contains tenant key and name", async () => {
    const res = await getEvents(makeRequest("/events"), makeParams());
    const body = await res.json();
    expect(body.tenant.key).toBe("fc-allschwil");
    expect(body.tenant.name).toBe("FC Allschwil");
  });

  it("response contains meta with total", async () => {
    const res = await getEvents(makeRequest("/events"), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("meta.total");
  });

  it("does not apply event-type filter — all visible types may appear", async () => {
    await getEvents(makeRequest("/events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    // No type restriction on the aggregate feed
    expect(call.where).not.toHaveProperty("type");
  });

  it("applies tenant isolation", async () => {
    await getEvents(makeRequest("/events"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });
});
