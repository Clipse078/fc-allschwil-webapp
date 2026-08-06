/**
 * lib/events/__tests__/sfv-tournament-01-e3-publication.test.ts
 *
 * SFV-TOURNAMENT-01 — Publication chain verification for the FC Allschwil E3
 * tournament examples (23.08.2026, 06.09.2026, 13.09.2026).
 *
 * Investigation finding: a live query of GET /api/club/schedule for Club 483
 * / Season 2027 (see docs/integrations/sfv-tournament-01-investigation.md)
 * returns zero rows referencing an E3 team on any date in the season — the
 * schedule endpoint does not expose tournaments. The safe, currently-working
 * path is manual tournament creation
 * (Event.type = "TOURNAMENT", Event.source = "MANUAL") via
 * `components/admin/events/TournamentEventCreateForm.tsx` → `POST /api/events`.
 *
 * These tests prove that manually-created E3 tournament events for the three
 * verification dates flow correctly through the existing, unmodified
 * publication chain:
 *
 *   canonical Event (type=TOURNAMENT)
 *     → lib/events/public-event-feed.ts (getPublicEvents, tenant + type scoped)
 *     → GET /api/public/[tenant]/website/tournaments (via toPublicWebsiteEvent)
 *     → lib/publishing/policy/publication-policy.ts (WEBSITE_TOURNAMENTS, INFOBOARD_SCREEN_1)
 *
 * No production/STAGE database is touched — Prisma is fully mocked.
 *
 * TEST COVERAGE MAP:
 *   A. The three E3 dates are returned by the tournaments website feed, tenant-scoped.
 *   B. Tenant isolation — a second tenant's E3 tournaments never leak into tenant A's feed.
 *   C. Publication eligibility — each E3 date is ELIGIBLE for WEBSITE_TOURNAMENTS and Infoboard.
 *   D. Visibility gating — infoboardVisible=false / websiteVisible=false correctly exclude.
 *   E. Manual-source preservation — source=MANUAL is never rewritten and never exposed publicly.
 *   F. Unmapped team handling — a tournament with team=null is not corrupted or dropped.
 *   G. Idempotency — repeated reads of the same data return identical publication decisions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mockFindMany },
  },
}));

vi.mock("@/lib/facilities/display-helpers", () => ({
  batchGetEventAllocationDisplayForTenant: vi.fn().mockResolvedValue([]),
}));

const { getPublicEvents, TOURNAMENT_EVENT_TYPES } = await import("../public-event-feed");
const { toPublicWebsiteEvent } = await import("@/lib/website/public-events-mapper");
const { evaluatePublication } = await import("@/lib/publishing/policy/publication-policy");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_FCA = "tenant-fc-allschwil";
const TENANT_OTHER = "tenant-other-club";

const SEASON_2526 = {
  id: "season-2025-26",
  key: "2025-26",
  name: "Saison 2025/26",
  startDate: new Date("2025-07-01"),
  endDate: new Date("2026-06-30"),
  isActive: true,
};

const TEAM_E3 = {
  id: "team-e3",
  name: "E3",
  slug: "e3",
  category: "JUNIOREN",
  genderGroup: null,
  ageGroup: "E",
};

/** The three FC Allschwil E3 verification dates from the task brief. */
const E3_DATES = ["2026-08-23", "2026-09-06", "2026-09-13"] as const;

function makeE3TournamentRow(
  date: (typeof E3_DATES)[number],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `tournament-e3-${date}`,
    title: `E3 Turnier ${date}`,
    description: null,
    location: "Sportanlage Im Brüel",
    type: "TOURNAMENT",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date(`${date}T09:00:00.000Z`),
    endAt: new Date(`${date}T13:00:00.000Z`),
    opponentName: null,
    organizerName: "FC Allschwil",
    competitionLabel: "Jugendturnier",
    homeAway: null,
    resultLabel: null,
    meetingTime: null,
    websiteVisible: true,
    infoboardVisible: true,
    homepageVisible: true,
    wochenplanVisible: true,
    trainingsplanVisible: false,
    teamPageVisible: true,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: SEASON_2526,
    team: TEAM_E3,
    tenantId: TENANT_FCA,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── A. Website tournaments feed returns the three E3 dates ───────────────────

describe("A. E3 tournaments appear in the tenant-scoped tournaments feed", () => {
  it("returns all three E3 verification dates for tenant fc-allschwil", async () => {
    const rows = E3_DATES.map((d) => makeE3TournamentRow(d));
    mockFindMany.mockResolvedValue(rows);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(events).toHaveLength(3);
    const startDates = events.map((e) => e.startAt.toISOString().slice(0, 10));
    expect(startDates).toEqual(E3_DATES.map((d) => d));
  });

  it("applies the TOURNAMENT type filter at the query level", async () => {
    mockFindMany.mockResolvedValue([]);

    await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.type).toEqual({ in: ["TOURNAMENT"] });
  });

  it("maps each E3 row to the public website-safe tournament shape", async () => {
    mockFindMany.mockResolvedValue([makeE3TournamentRow("2026-08-23")]);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    const publicItem = toPublicWebsiteEvent(events[0]);

    expect(publicItem.type).toBe("TOURNAMENT");
    expect(publicItem.organizerName).toBe("FC Allschwil");
    expect(publicItem.team?.slug).toBe("e3");
    expect(publicItem.season.key).toBe("2025-26");
  });
});

// ── B. Tenant isolation ────────────────────────────────────────────────────────

describe("B. Tenant isolation", () => {
  it("scopes the query to the requesting tenant only", async () => {
    mockFindMany.mockResolvedValue([]);

    await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe(TENANT_FCA);
  });

  it("a second tenant's E3-named tournament is never returned for tenant fc-allschwil's query", async () => {
    // Simulate correct DB-level isolation: the mock only returns rows the
    // WHERE clause would actually match (tenantId = TENANT_FCA).
    mockFindMany.mockImplementation(async (args: { where: { tenantId?: string } }) => {
      const rows = [
        makeE3TournamentRow("2026-08-23", { tenantId: TENANT_FCA }),
        makeE3TournamentRow("2026-08-23", {
          id: "tournament-other-tenant",
          tenantId: TENANT_OTHER,
        }),
      ];
      return rows.filter((r) => r.tenantId === args.where.tenantId);
    });

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("tournament-e3-2026-08-23");
  });
});

// ── C. Publication eligibility for each E3 date ───────────────────────────────

describe("C. Publication eligibility — WEBSITE_TOURNAMENTS and Infoboard", () => {
  it.each(E3_DATES)("E3 tournament on %s is eligible for WEBSITE_TOURNAMENTS", (date) => {
    const row = makeE3TournamentRow(date);

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "WEBSITE_TOURNAMENTS",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });

  it.each(E3_DATES)("E3 tournament on %s is eligible for INFOBOARD_SCREEN_1", (date) => {
    const row = makeE3TournamentRow(date);

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "INFOBOARD_SCREEN_1",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });

  it.each(E3_DATES)("E3 tournament on %s is eligible for INFOBOARD_SCREEN_2", (date) => {
    const row = makeE3TournamentRow(date);

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "INFOBOARD_SCREEN_2",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });
});

// ── D. Visibility gating ───────────────────────────────────────────────────────

describe("D. Visibility gating", () => {
  it("infoboardVisible=false excludes the E3 tournament from Infoboard", () => {
    const row = makeE3TournamentRow("2026-08-23", { infoboardVisible: false });

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "INFOBOARD_SCREEN_1",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: false, reason: "INFOBOARD_HIDDEN" });
  });

  it("websiteVisible=false excludes the E3 tournament from the website feed", () => {
    const row = makeE3TournamentRow("2026-09-06", { websiteVisible: false });

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "WEBSITE_TOURNAMENTS",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: false, reason: "WEBSITE_HIDDEN" });
  });

  it("DRAFT status excludes the E3 tournament from every channel", () => {
    const row = makeE3TournamentRow("2026-09-13", { status: "DRAFT" });

    for (const channel of ["WEBSITE_TOURNAMENTS", "INFOBOARD_SCREEN_1"] as const) {
      const decision = evaluatePublication(
        {
          tenantId: row.tenantId,
          type: row.type,
          status: row.status,
          infoboardVisible: row.infoboardVisible,
          websiteVisible: row.websiteVisible,
          trainingsplanVisible: row.trainingsplanVisible,
          homeAway: row.homeAway,
        },
        channel,
        TENANT_FCA,
      );
      expect(decision.eligible).toBe(false);
      expect(decision.reason).toBe("STATUS_NOT_PUBLISHABLE");
    }
  });
});

// ── E. Manual-source preservation and privacy ─────────────────────────────────

describe("E. Manual-source preservation", () => {
  it("source=MANUAL is preserved through the internal feed (never rewritten to SFV)", async () => {
    mockFindMany.mockResolvedValue([makeE3TournamentRow("2026-08-23", { source: "MANUAL" })]);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(events[0].source).toBe("MANUAL");
  });

  it("source is never exposed on the public website mapper output (privacy exclusion)", async () => {
    mockFindMany.mockResolvedValue([makeE3TournamentRow("2026-08-23", { source: "MANUAL" })]);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    const publicItem = toPublicWebsiteEvent(events[0]) as unknown as Record<string, unknown>;
    expect(publicItem.source).toBeUndefined();
  });
});

// ── F. Unmapped team handling ──────────────────────────────────────────────────

describe("F. Unmapped team handling", () => {
  it("a tournament with no resolved team (team=null) is still returned, not corrupted", async () => {
    mockFindMany.mockResolvedValue([makeE3TournamentRow("2026-09-06", { team: null })]);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(events).toHaveLength(1);
    expect(events[0].team).toBeNull();
  });

  it("the public mapper renders team=null gracefully (no throw, null passthrough)", async () => {
    mockFindMany.mockResolvedValue([makeE3TournamentRow("2026-09-06", { team: null })]);

    const events = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(() => toPublicWebsiteEvent(events[0])).not.toThrow();
    expect(toPublicWebsiteEvent(events[0]).team).toBeNull();
  });

  it("publication eligibility is unaffected by a missing team (policy does not inspect team)", () => {
    const row = makeE3TournamentRow("2026-09-06", { team: null });

    const decision = evaluatePublication(
      {
        tenantId: row.tenantId,
        type: row.type,
        status: row.status,
        infoboardVisible: row.infoboardVisible,
        websiteVisible: row.websiteVisible,
        trainingsplanVisible: row.trainingsplanVisible,
        homeAway: row.homeAway,
      },
      "WEBSITE_TOURNAMENTS",
      TENANT_FCA,
    );

    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });
});

// ── G. Idempotency ─────────────────────────────────────────────────────────────

describe("G. Idempotency", () => {
  it("repeated evaluatePublication calls for the same E3 event return identical decisions", () => {
    const row = makeE3TournamentRow("2026-08-23");
    const input = {
      tenantId: row.tenantId,
      type: row.type,
      status: row.status,
      infoboardVisible: row.infoboardVisible,
      websiteVisible: row.websiteVisible,
      trainingsplanVisible: row.trainingsplanVisible,
      homeAway: row.homeAway,
    };

    const first = evaluatePublication(input, "WEBSITE_TOURNAMENTS", TENANT_FCA);
    const second = evaluatePublication(input, "WEBSITE_TOURNAMENTS", TENANT_FCA);
    const third = evaluatePublication(input, "WEBSITE_TOURNAMENTS", TENANT_FCA);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });

  it("repeated getPublicEvents reads for the same underlying data return the same set of E3 dates", async () => {
    const rows = E3_DATES.map((d) => makeE3TournamentRow(d));
    mockFindMany.mockResolvedValue(rows);

    const firstRead = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });
    const secondRead = await getPublicEvents({
      surface: "all",
      tenantId: TENANT_FCA,
      eventTypes: TOURNAMENT_EVENT_TYPES,
    });

    expect(firstRead.map((e) => e.id)).toEqual(secondRead.map((e) => e.id));
  });
});
