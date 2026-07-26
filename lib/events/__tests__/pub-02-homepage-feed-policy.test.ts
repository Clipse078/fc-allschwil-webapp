/**
 * lib/events/__tests__/pub-02-homepage-feed-policy.test.ts
 *
 * PUB-02 — Homepage feed policy tests.
 *
 * Verifies that the homepage surface uses websiteVisible only,
 * not homepageVisible, per the PUB-02 publication policy.
 *
 * TEST COVERAGE MAP:
 *
 *   H-PUB02-1. websiteVisible=true → match included in homepage surface
 *   H-PUB02-2. websiteVisible=false → match excluded from homepage surface
 *   H-PUB02-3. homepageVisible=false does NOT suppress a website-visible match
 *   H-PUB02-4. Homepage predicate does NOT include homepageVisible=true
 *   H-PUB02-5. Home match → homepage-eligible when websiteVisible=true
 *   H-PUB02-6. Away match → homepage-eligible when websiteVisible=true
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mockFindMany },
  },
}));

// Also mock batchGetEventAllocationDisplayForTenant to avoid facility DB calls
vi.mock("@/lib/facilities/display-helpers", () => ({
  batchGetEventAllocationDisplayForTenant: vi.fn().mockResolvedValue([]),
}));

const { getPublicEvents } = await import("../public-event-feed");

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
  name: "FC Allschwil 1",
  slug: "aktive-1",
  category: "AKTIVE",
  genderGroup: null,
  ageGroup: null,
};

function makeMatchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "match-home-1",
    title: "Test Match",
    description: null,
    location: "Im Brüel",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    startAt: FUTURE_DATE,
    endAt: null,
    opponentName: "FC Opponent",
    organizerName: null,
    competitionLabel: "3. Liga",
    homeAway: "HOME",
    resultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: true,
    homepageVisible: false, // deliberately false to test policy
    wochenplanVisible: false,
    trainingsplanVisible: false,
    teamPageVisible: false,
    remarks: null,
    pitchCode: "STADION",
    homeDressingRoomCode: "E1",
    awayDressingRoomCode: "E2",
    season: BASE_SEASON,
    team: FCA_TEAM,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PUB-02 — Homepage feed policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("H-PUB02-4: homepage surface predicate does NOT require homepageVisible=true", async () => {
    await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    const call = mockFindMany.mock.calls[0][0];
    // homepage must use websiteVisible=true
    expect(call.where.websiteVisible).toBe(true);
    // homepage must NOT require homepageVisible=true
    expect(call.where).not.toHaveProperty("homepageVisible");
  });

  it("H-PUB02-1: websiteVisible=true → match included in homepage surface", async () => {
    mockFindMany.mockResolvedValue([makeMatchRow({ websiteVisible: true })]);

    const results = await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    expect(results).toHaveLength(1);
    expect(results[0].visibility.website).toBe(true);
  });

  it("H-PUB02-2: websiteVisible=false → query predicate excludes the match", async () => {
    // The query itself filters websiteVisible=true at DB level.
    // mockFindMany returns empty when websiteVisible=false is on the record.
    mockFindMany.mockResolvedValue([]); // DB returns nothing because predicate filters it

    const results = await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    expect(results).toHaveLength(0);
    // Confirm the WHERE clause has websiteVisible=true (that's what excludes false)
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.websiteVisible).toBe(true);
  });

  it("H-PUB02-3: homepageVisible=false does NOT suppress a website-visible match", async () => {
    // A match with websiteVisible=true but homepageVisible=false should still appear
    mockFindMany.mockResolvedValue([
      makeMatchRow({ websiteVisible: true, homepageVisible: false }),
    ]);

    const results = await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    expect(results).toHaveLength(1);
    expect(results[0].visibility.website).toBe(true);
    // homepageVisible is false on the record — but that doesn't matter
    expect(results[0].visibility.homepage).toBe(false);
  });

  it("H-PUB02-5: home match → homepage-eligible when websiteVisible=true", async () => {
    mockFindMany.mockResolvedValue([makeMatchRow({ homeAway: "HOME", websiteVisible: true })]);

    const results = await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    expect(results).toHaveLength(1);
    expect(results[0].homeAway).toBe("HOME");
  });

  it("H-PUB02-6: away match → homepage-eligible when websiteVisible=true", async () => {
    mockFindMany.mockResolvedValue([makeMatchRow({ homeAway: "AWAY", websiteVisible: true })]);

    const results = await getPublicEvents({ surface: "homepage", tenantId: "tenant-fca" });

    expect(results).toHaveLength(1);
    expect(results[0].homeAway).toBe("AWAY");
  });
});
