/**
 * WEBSITE-CONSUMERS-01C — Tournament ↔ Team Publication
 *
 * Tests for GET /api/public/[tenant]/website/tournaments
 *
 * Architectural rule (hard):
 *   A canonical Tournament Event represents ONE FCA team's participation.
 *   F1 and F2 attending the same real-world tournament are represented as TWO
 *   separate Event records — one per team. They MUST NOT be deduplicated by
 *   tournament name, organiser, venue, date, or any other metadata.
 *
 * Covers:
 *   5.  F1 Tournament participation is linked to F1 (team.id / team.slug)
 *   6.  F2 participation is independently linked to F2
 *   7.  Identical tournament metadata does NOT cause F1/F2 records to deduplicate
 *   8.  Public Turnierplan returns both F1 and F2 records
 *   9.  teamSlug filter returns only that team's tournaments (not the other's)
 *   10. Cross-tenant records cannot leak
 *   11. Archived/non-public tournaments do not publish
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTournamentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-t1",
    title: "Jugendturnier Allschwil",
    description: null,
    location: "Sportanlage Bachgraben",
    type: "TOURNAMENT",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date("2026-09-20T08:00:00.000Z"),
    endAt: new Date("2026-09-20T18:00:00.000Z"),
    opponentName: null,
    organizerName: "FC Allschwil",
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
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findFirst: mocks.tenantFindFirst },
    event: { findMany: mocks.eventFindMany },
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

const BASE_URL = "http://localhost/api/public/fc-allschwil/website/tournaments";

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`${BASE_URL}${query ? "?" + query : ""}`, { method: "GET" });
}

function makeParams(slug = "fc-allschwil") {
  return { params: Promise.resolve({ tenant: slug }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/public/[tenant]/website/tournaments — team participation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  // 5. F1 Tournament linked to F1 team
  it("F1 tournament record carries F1 team identity", async () => {
    mocks.eventFindMany.mockResolvedValue([makeTournamentRow()]);
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    const t = body.data.tournaments[0];
    expect(t.team.id).toBe("team-f1");
    expect(t.team.slug).toBe("f1");
  });

  // 6. F2 participation is independently linked to F2
  it("F2 tournament record carries F2 team identity", async () => {
    const f2Row = makeTournamentRow({
      id: "evt-t2",
      team: {
        id: "team-f2",
        name: "FC Allschwil F2",
        slug: "f2",
        category: "AKTIVE",
        genderGroup: "MALE",
        ageGroup: null,
      },
    });
    mocks.eventFindMany.mockResolvedValue([f2Row]);
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    const t = body.data.tournaments[0];
    expect(t.team.id).toBe("team-f2");
    expect(t.team.slug).toBe("f2");
  });

  // 7 + 8. Identical metadata does NOT deduplicate; Turnierplan returns both
  it("F1 and F2 records with identical metadata are NOT deduplicated", async () => {
    const sharedMeta = {
      title: "Jugendturnier Allschwil",
      organizerName: "FC Allschwil",
      location: "Sportanlage Bachgraben",
      startAt: new Date("2026-09-20T08:00:00.000Z"),
    };
    const f1Row = makeTournamentRow({ id: "evt-t-f1", ...sharedMeta, team: { id: "team-f1", name: "F1", slug: "f1", category: "AKTIVE", genderGroup: "MALE", ageGroup: null } });
    const f2Row = makeTournamentRow({ id: "evt-t-f2", ...sharedMeta, team: { id: "team-f2", name: "F2", slug: "f2", category: "AKTIVE", genderGroup: "MALE", ageGroup: null } });
    mocks.eventFindMany.mockResolvedValue([f1Row, f2Row]);

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    // Both records must appear — no deduplication
    expect(body.data.tournaments).toHaveLength(2);
    const slugs = body.data.tournaments.map((t: { team: { slug: string } }) => t.team.slug);
    expect(slugs).toContain("f1");
    expect(slugs).toContain("f2");
  });

  // 9. teamSlug filter returns only that team's tournaments
  it("teamSlug=f1 filter is applied at DB level (only F1 records returned)", async () => {
    await GET(makeRequest("teamSlug=f1"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.team).toEqual({ slug: "f1" });
  });

  it("teamSlug=f1 query does not return F2 records", async () => {
    // DB returns only F1 records when teamSlug=f1 is applied
    mocks.eventFindMany.mockResolvedValue([makeTournamentRow()]);
    const res = await GET(makeRequest("teamSlug=f1"), makeParams());
    const body = await res.json();
    body.data.tournaments.forEach((t: { team: { slug: string } }) => {
      expect(t.team.slug).toBe("f1");
    });
  });

  it("teamSlug=f2 filter scopes to F2 team only", async () => {
    await GET(makeRequest("teamSlug=f2"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.team).toEqual({ slug: "f2" });
  });

  // 10. Cross-tenant records cannot leak
  it("tenant isolation enforced — DB query includes tenantId", async () => {
    await GET(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-fca");
  });

  it("cross-tenant: other-club query uses other-club tenantId", async () => {
    const otherTenant = { ...ACTIVE_TENANT, id: "tenant-other", key: "other-club" };
    mocks.tenantFindFirst.mockResolvedValue(otherTenant);
    await GET(makeRequest(), makeParams("other-club"));
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-other");
    expect(call.where.tenantId).not.toBe("tenant-fca");
  });

  // 11. Archived/non-public tournaments excluded
  it("DB status filter excludes ARCHIVED/CANCELLED/DRAFT tournaments", async () => {
    await GET(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"] });
    expect(call.where.status.in).not.toContain("ARCHIVED");
    expect(call.where.status.in).not.toContain("CANCELLED");
    expect(call.where.status.in).not.toContain("DRAFT");
  });

  it("DB filter enforces websiteVisible=true", async () => {
    await GET(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.websiteVisible).toBe(true);
  });

  // Type filter — TOURNAMENT only
  it("DB filter restricts to TOURNAMENT type only", async () => {
    await GET(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.type).toEqual({ in: ["TOURNAMENT"] });
  });

  it("response contains team.id and team.slug for each tournament", async () => {
    mocks.eventFindMany.mockResolvedValue([makeTournamentRow()]);
    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();
    const t = body.data.tournaments[0];
    expect(t.team).toHaveProperty("id");
    expect(t.team).toHaveProperty("slug");
    expect(t.team).toHaveProperty("name");
  });
});

describe("GET /api/public/[tenant]/website/tournaments — season filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantFindFirst.mockResolvedValue(ACTIVE_TENANT);
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("seasonKey filter is applied at DB level", async () => {
    await GET(makeRequest("seasonKey=2026-27"), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where.season).toEqual({ key: "2026-27" });
  });

  it("without seasonKey, no season filter is applied (all seasons)", async () => {
    await GET(makeRequest(), makeParams());
    const call = mocks.eventFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("season");
  });
});
