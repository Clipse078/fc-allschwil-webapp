/**
 * PUB-01 — Website Match Publication Regression Tests
 *
 * Covers every predicate in the canonical website matches query
 * GET /api/public/[tenant]/website/matches and the Matchcenter mutation
 * PATCH /api/matchcenter/[matchId].
 *
 * Regression assertions:
 *   1. Upcoming HOME match with websiteVisible=true is returned.
 *   2. Upcoming AWAY match with websiteVisible=true is returned.
 *   3. websiteVisible=false excludes the match.
 *   4. infoboardVisible=false does NOT exclude from website feed.
 *   5. Missing pitchCode does NOT exclude from website feed.
 *   6. Missing dressingRoom codes do NOT exclude from website feed.
 *   7. infoboardVisible=true alone (without websiteVisible=true) does NOT
 *      include the match in the website feed.
 *   8. Tenant isolation: match from a different tenant is not returned.
 *   9. Archived/CANCELLED status excludes the match.
 *  10. POSTPONED status keeps the match in the website feed.
 *  11. DB-level type filter only passes MATCH events.
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  tenantFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: {
      findMany: mocks.eventFindMany,
      findFirst: vi.fn().mockResolvedValue({ id: "match-test-1" }),
      update: vi.fn().mockResolvedValue({
        id: "match-test-1",
        websiteVisible: true,
        infoboardVisible: false,
        teamId: "team-fca",
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      }),
    },
    team: { findFirst: vi.fn().mockResolvedValue({ id: "team-fca" }) },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "user-1", tenantId: "tenant-fca" } },
  }),
}));

// Import route handlers after mocks are set up
const { GET: getMatches } = await import("../route");
const { PATCH } = await import("@/app/api/matchcenter/[matchId]/route");

// ── Shared fixtures ────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
  websiteEnabled: true,
  approvedDataOnly: false,
};

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const BASE_SEASON = {
  id: "s1",
  key: "2025-26",
  name: "Saison 2025/26",
  startDate: new Date("2025-07-01"),
  endDate: new Date("2026-06-30"),
  isActive: true,
};

const FCA_TEAM = {
  id: "team-fca",
  name: "FC Allschwil 1. Mannschaft",
  slug: "aktive-1",
  category: "AKTIVE",
  genderGroup: null,
  ageGroup: null,
};

function makeMatchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-concordia-1",
    title: "3. Liga — vs FC Concordia Basel",
    description: null,
    location: "Sportanlage Moos",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    startAt: FUTURE_DATE,
    endAt: null,
    opponentName: "FC Concordia Basel",
    organizerName: null,
    competitionLabel: "3. Liga",
    homeAway: "AWAY",
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
    season: BASE_SEASON,
    team: FCA_TEAM,
    ...overrides,
  };
}

const BASE_URL = "http://localhost/api/public/fc-allschwil/website/matches";

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}${query ? "?" + query : ""}`, {
    method: "GET",
  });
}

function makeParams(slug = "fc-allschwil") {
  return { params: Promise.resolve({ tenant: slug }) };
}

function makeMatchcenterContext(matchId = "match-test-1") {
  return { params: Promise.resolve({ matchId }) };
}

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/matchcenter/match-test-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── 1. Home match with websiteVisible=true is returned ─────────────────────────

describe("PUB-01 — away match website publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("returns an upcoming HOME match with websiteVisible=true", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "HOME" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    expect(body.data.matches[0].homeAway).toBe("HOME");
  });

  it("returns an upcoming AWAY match with websiteVisible=true", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    expect(body.data.matches[0].homeAway).toBe("AWAY");
  });

  it("the canonical query requires websiteVisible=true — away matches are NOT excluded by homeAway filter", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    // Must require websiteVisible=true
    expect(call.where.websiteVisible).toBe(true);
    // Must NOT filter by homeAway
    expect(call.where).not.toHaveProperty("homeAway");
  });

  it("excludes the match when websiteVisible=false", async () => {
    // DB will never return events where websiteVisible=false (filtered by query)
    // This test verifies the WHERE clause contains websiteVisible: true
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.websiteVisible).toBe(true);
  });

  it("does NOT exclude from website feed when infoboardVisible=false", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeMatchRow({ homeAway: "AWAY", infoboardVisible: false, websiteVisible: true }),
    ]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    // Confirm the query does NOT require infoboardVisible
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("infoboardVisible");
  });

  it("does NOT exclude from website feed when pitchCode is null", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeMatchRow({ homeAway: "AWAY", pitchCode: null, websiteVisible: true }),
    ]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("pitchCode");
  });

  it("does NOT exclude from website feed when dressing rooms are null", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeMatchRow({
        homeAway: "AWAY",
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
        websiteVisible: true,
      }),
    ]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("homeDressingRoomCode");
    expect(call.where).not.toHaveProperty("awayDressingRoomCode");
  });

  it("infoboardVisible=true alone (without websiteVisible=true) is not enough for website feed", async () => {
    // The website query requires websiteVisible=true, not infoboardVisible
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.websiteVisible).toBe(true);
    // infoboard visible is NOT required for the website feed
    expect(call.where).not.toHaveProperty("infoboardVisible");
  });

  it("the infoboard surface home-only rule does NOT apply to the website matches query", async () => {
    // Infoboard uses infoboardVisible: true and rejects homeAway !== 'HOME'
    // Website matches must NOT use this rule
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    // Website surface: only websiteVisible is checked, not infoboardVisible
    expect(call.where.websiteVisible).toBe(true);
    expect(call.where).not.toHaveProperty("infoboardVisible");
    expect(call.where).not.toHaveProperty("homeAway");
  });

  it("enforces tenant isolation — only events for the resolved tenant are returned", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("events from a different tenant cannot appear", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await getMatches(makeRequest(), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  it("CANCELLED match is excluded (status filter)", async () => {
    // Verify status filter does not include CANCELLED
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.status.in).not.toContain("CANCELLED");
    expect(call.where.status.in).not.toContain("ARCHIVED");
    expect(call.where.status.in).not.toContain("DRAFT");
  });

  it("POSTPONED match remains in the website feed", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.status.in).toContain("POSTPONED");
  });

  it("SCHEDULED status is included in the website feed", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.status.in).toContain("SCHEDULED");
    expect(call.where.status.in).toContain("LIVE");
    expect(call.where.status.in).toContain("COMPLETED");
  });

  it("type filter is MATCH-only at DB level", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["MATCH"] });
  });

  it("TRAINING events are excluded by type filter", async () => {
    await getMatches(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type.in).not.toContain("TRAINING");
  });

  it("the response envelope contains data.matches array", async () => {
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(body).toHaveProperty("data.matches");
    expect(Array.isArray(body.data.matches)).toBe(true);
  });

  it("the response does not expose visibility or allocation fields", async () => {
    mocks.eventFindMany.mockResolvedValue([
      makeMatchRow({ homeAway: "AWAY", websiteVisible: true }),
    ]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    const item = body.data.matches[0];
    expect(item).not.toHaveProperty("websiteVisible");
    expect(item).not.toHaveProperty("infoboardVisible");
    expect(item).not.toHaveProperty("pitchCode");
    expect(item).not.toHaveProperty("homeDressingRoomCode");
    expect(item).not.toHaveProperty("awayDressingRoomCode");
  });

  it("away match response includes homeAway field for website rendering", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.matches[0].homeAway).toBe("AWAY");
  });

  it("away match response includes team assignment", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    const match = body.data.matches[0];
    expect(match.team).not.toBeNull();
    expect(match.team.id).toBe("team-fca");
    expect(match.team.slug).toBe("aktive-1");
  });

  it("away match response includes opponent name", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.matches[0].opponentName).toBe("FC Concordia Basel");
  });

  it("away match response includes competition label", async () => {
    mocks.eventFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY" })]);
    const res = await getMatches(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.data.matches[0].competitionLabel).toBe("3. Liga");
  });

  it("500 response is safe — no internal error text exposed", async () => {
    mocks.eventFindMany.mockRejectedValue(new Error("DB connection refused at 10.0.0.1:5432"));
    const res = await getMatches(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/10\.0\.0\.1|5432|DB connection/);
    expect(body.error).toMatch(/technischer Fehler/i);
  });

  it("returns 404 when tenant is not found", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);
    const res = await getMatches(makeRequest(), makeParams("unknown"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when website is not enabled for the tenant", async () => {
    mocks.tenantFindFirst.mockResolvedValue({ ...ACTIVE_TENANT, websiteEnabled: false });
    const res = await getMatches(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });
});

// ── Matchcenter PATCH — website visibility persistence ─────────────────────────

describe("PUB-01 — Matchcenter PATCH persists websiteVisible correctly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists websiteVisible=true when admin enables website visibility", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    const mockUpdate = vi.spyOn(prismaModule.prisma.event, "update");

    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext(),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ websiteVisible: true }),
      }),
    );
  });

  it("persists websiteVisible=false when admin disables website visibility", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    const mockUpdate = vi.spyOn(prismaModule.prisma.event, "update");

    await PATCH(
      makePatchRequest({ websiteVisible: false }),
      makeMatchcenterContext(),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ websiteVisible: false }),
      }),
    );
  });

  it("enabling websiteVisible does NOT also enable infoboardVisible", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    const mockUpdate = vi.spyOn(prismaModule.prisma.event, "update");

    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext(),
    );

    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.websiteVisible).toBe(true);
    // infoboardVisible must NOT be touched if not in the payload
    expect(updateData).not.toHaveProperty("infoboardVisible");
  });

  it("disabling infoboard does NOT affect websiteVisible", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    const mockUpdate = vi.spyOn(prismaModule.prisma.event, "update");

    await PATCH(
      makePatchRequest({ infoboardVisible: false }),
      makeMatchcenterContext(),
    );

    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.infoboardVisible).toBe(false);
    // websiteVisible must NOT be touched
    expect(updateData).not.toHaveProperty("websiteVisible");
  });

  it("calls revalidatePath for the admin matchcenter list page after save", async () => {
    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext("match-test-1"),
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/matchcenter");
  });

  it("calls revalidatePath for the admin matchcenter detail page after save", async () => {
    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext("match-test-1"),
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/matchcenter/match-test-1",
    );
  });

  it("revalidatePath is NOT called when the event is not found (no update)", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    vi.spyOn(prismaModule.prisma.event, "findFirst").mockResolvedValueOnce(null);

    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext("nonexistent"),
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("websiteVisible field is correctly named in the PATCH payload (not showOnWebsite or similar)", async () => {
    const prismaModule = await import("@/lib/db/prisma");
    const mockUpdate = vi.spyOn(prismaModule.prisma.event, "update");

    await PATCH(
      makePatchRequest({ websiteVisible: true }),
      makeMatchcenterContext(),
    );

    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(Object.keys(updateData)).toContain("websiteVisible");
  });
});
