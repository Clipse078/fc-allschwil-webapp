/**
 * Tests for lib/events/public-event-feed.ts
 *
 * Core invariant: every public query MUST include reviewStage: "PUBLISHED"
 * AND the appropriate channel visibility flag.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock Prisma before importing the module under test ---
// vi.mock is hoisted to the top of the file by Vitest, so the factory must
// use vi.hoisted() to share the spy reference across the mock boundary.
const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findMany: mockFindMany,
    },
  },
}));

import {
  getPublicEvents,
  getGroupedWochenplan,
  getInfoboardFeed,
} from "@/lib/events/public-event-feed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    title: "Test Event",
    description: null,
    location: null,
    type: "MATCH",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt: new Date("2026-07-01T10:00:00Z"),
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
    season: {
      id: "s1",
      key: "2025-26",
      name: "Saison 2025/26",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-07-31"),
      isActive: true,
    },
    team: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getPublicEvents — reviewStage gate
// ---------------------------------------------------------------------------

describe("getPublicEvents — reviewStage gate", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("always passes reviewStage: PUBLISHED in the where clause", async () => {
    await getPublicEvents({ surface: "all" });

    expect(mockFindMany).toHaveBeenCalledOnce();
    const [call] = mockFindMany.mock.calls;
    const where = call[0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });

  it("passes reviewStage: PUBLISHED for surface=homepage", async () => {
    await getPublicEvents({ surface: "homepage" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });

  it("passes reviewStage: PUBLISHED for surface=wochenplan", async () => {
    await getPublicEvents({ surface: "wochenplan" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });

  it("passes reviewStage: PUBLISHED for surface=infoboard", async () => {
    await getPublicEvents({ surface: "infoboard" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });

  it("passes reviewStage: PUBLISHED for surface=trainingsplan", async () => {
    await getPublicEvents({ surface: "trainingsplan" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });

  it("passes reviewStage: PUBLISHED for surface=team-page", async () => {
    await getPublicEvents({ surface: "team-page" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
  });
});

// ---------------------------------------------------------------------------
// getPublicEvents — channel visibility flags
// ---------------------------------------------------------------------------

describe("getPublicEvents — channel visibility flags", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("surface=all requires websiteVisible: true", async () => {
    await getPublicEvents({ surface: "all" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.websiteVisible).toBe(true);
    expect(where.infoboardVisible).toBeUndefined();
  });

  it("surface=homepage requires websiteVisible AND homepageVisible", async () => {
    await getPublicEvents({ surface: "homepage" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.websiteVisible).toBe(true);
    expect(where.homepageVisible).toBe(true);
  });

  it("surface=wochenplan requires websiteVisible AND wochenplanVisible", async () => {
    await getPublicEvents({ surface: "wochenplan" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.websiteVisible).toBe(true);
    expect(where.wochenplanVisible).toBe(true);
  });

  it("surface=infoboard requires infoboardVisible (no websiteVisible)", async () => {
    await getPublicEvents({ surface: "infoboard" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.infoboardVisible).toBe(true);
    expect(where.websiteVisible).toBeUndefined();
  });

  it("surface=trainingsplan requires websiteVisible AND trainingsplanVisible", async () => {
    await getPublicEvents({ surface: "trainingsplan" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.websiteVisible).toBe(true);
    expect(where.trainingsplanVisible).toBe(true);
  });

  it("surface=team-page requires websiteVisible AND teamPageVisible", async () => {
    await getPublicEvents({ surface: "team-page" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.websiteVisible).toBe(true);
    expect(where.teamPageVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPublicEvents — status filter
// ---------------------------------------------------------------------------

describe("getPublicEvents — status filter", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("only includes active statuses (SCHEDULED, LIVE, COMPLETED, POSTPONED)", async () => {
    await getPublicEvents({ surface: "all" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.status).toEqual({
      in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"],
    });
  });
});

// ---------------------------------------------------------------------------
// getPublicEvents — combined gate (reviewStage AND visibility must both be set)
// ---------------------------------------------------------------------------

describe("getPublicEvents — dual gate (reviewStage AND visibility)", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("where clause contains both reviewStage:PUBLISHED and a visibility flag for surface=all", async () => {
    await getPublicEvents({ surface: "all" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
    expect(where.websiteVisible).toBe(true);
  });

  it("where clause contains both reviewStage:PUBLISHED and infoboardVisible for surface=infoboard", async () => {
    await getPublicEvents({ surface: "infoboard" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
    expect(where.infoboardVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPublicEvents — optional filters
// ---------------------------------------------------------------------------

describe("getPublicEvents — optional filters", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("adds season filter when seasonKey is provided", async () => {
    await getPublicEvents({ surface: "all", seasonKey: "2025-26" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.season).toEqual({ key: "2025-26" });
  });

  it("adds team filter when teamSlug is provided", async () => {
    await getPublicEvents({ surface: "all", teamSlug: "u16" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.team).toEqual({ slug: "u16" });
  });

  it("adds dateFrom filter when provided", async () => {
    await getPublicEvents({ surface: "all", dateFrom: "2026-07-01" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect((where.startAt as Record<string, string>).gte).toBe("2026-07-01");
  });

  it("adds dateTo filter when provided", async () => {
    await getPublicEvents({ surface: "all", dateTo: "2026-07-31" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect((where.startAt as Record<string, string>).lte).toBe("2026-07-31");
  });

  it("clamps limit between 1 and 250", async () => {
    await getPublicEvents({ surface: "all", limit: 9999 });
    const take1 = mockFindMany.mock.calls[0][0].take;
    expect(take1).toBe(250);

    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);

    // limit: 0 is falsy — treated as "no value", falls back to default 100
    await getPublicEvents({ surface: "all", limit: 0 });
    const take2 = mockFindMany.mock.calls[0][0].take;
    expect(take2).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getPublicEvents — output shape
// ---------------------------------------------------------------------------

describe("getPublicEvents — output shape", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("maps DB rows to PublicEventItem with nested visibility object", async () => {
    const row = makeEvent({
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: false,
      wochenplanVisible: true,
      trainingsplanVisible: false,
      teamPageVisible: false,
    });
    mockFindMany.mockResolvedValue([row]);

    const result = await getPublicEvents({ surface: "all" });
    expect(result).toHaveLength(1);
    expect(result[0].visibility).toEqual({
      website: true,
      infoboard: true,
      homepage: false,
      wochenplan: true,
      trainingsplan: false,
      teamPage: false,
    });
  });

  it("returns an empty array when no events match", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getPublicEvents({ surface: "all" });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getGroupedWochenplan — delegates with surface=wochenplan
// ---------------------------------------------------------------------------

describe("getGroupedWochenplan", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("delegates to getPublicEvents with surface=wochenplan", async () => {
    await getGroupedWochenplan({ seasonKey: "2025-26" });

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
    expect(where.wochenplanVisible).toBe(true);
  });

  it("groups events by date", async () => {
    const events = [
      makeEvent({ id: "e1", startAt: new Date("2026-07-01T10:00:00Z"), wochenplanVisible: true }),
      makeEvent({ id: "e2", startAt: new Date("2026-07-01T14:00:00Z"), wochenplanVisible: true }),
      makeEvent({ id: "e3", startAt: new Date("2026-07-02T09:00:00Z"), wochenplanVisible: true }),
    ];
    mockFindMany.mockResolvedValue(events);

    const days = await getGroupedWochenplan({});
    expect(days).toHaveLength(2);
    expect(days[0].events).toHaveLength(2);
    expect(days[1].events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getInfoboardFeed — delegates with surface=infoboard
// ---------------------------------------------------------------------------

describe("getInfoboardFeed", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("delegates to getPublicEvents with surface=infoboard", async () => {
    await getInfoboardFeed({});

    const where = mockFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.reviewStage).toBe("PUBLISHED");
    expect(where.infoboardVisible).toBe(true);
  });

  it("returns slim infoboard shape (no visibility blob)", async () => {
    const row = makeEvent({ infoboardVisible: true, id: "e1" });
    mockFindMany.mockResolvedValue([row]);

    const result = await getInfoboardFeed({});
    expect(result).toHaveLength(1);
    const item = result[0];
    // Slim shape — no full visibility object
    expect(item).not.toHaveProperty("visibility");
    expect(item).toHaveProperty("startAt");
    expect(item).toHaveProperty("seasonKey");
    expect(item).toHaveProperty("status");
  });
});
