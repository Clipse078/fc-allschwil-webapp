/**
 * E. Weekplan timezone — verifies that getGroupedWochenplan groups events by
 * Europe/Zurich local calendar date, not server-local or UTC date.
 *
 * Europe/Zurich is UTC+2 in summer (CEST) and UTC+1 in winter (CET).
 *
 * Test cases:
 *   E1. Summer UTC crossing: 2026-07-23T22:15:00Z = 2026-07-24 00:15 Zurich → key "2026-07-24"
 *   E2. Winter UTC crossing: 2026-01-15T23:15:00Z = 2026-01-16 00:15 Zurich → key "2026-01-16"
 *   E3. Mid-day event groups under the correct Zurich date (no boundary issue)
 *   E4. Weekday label matches the Europe/Zurich local date (Thursday for "2026-07-24")
 *   E5. Calendar week is computed from the Zurich local date
 */

import { describe, it, expect, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findMany: mocks.eventFindMany },
  },
}));

const { getGroupedWochenplan } = await import("@/lib/events/public-event-feed");

// ── Base event template ────────────────────────────────────────────────────────

function makeWochenplanRow(startAt: Date) {
  return {
    id: "evt-wp-1",
    title: "Training A",
    description: null,
    location: null,
    type: "TRAINING",
    source: "MANUAL",
    status: "SCHEDULED",
    startAt,
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
    wochenplanVisible: true,
    trainingsplanVisible: true,
    teamPageVisible: false,
    remarks: null,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    season: {
      id: "s1",
      key: "2025-26",
      name: "Saison 2025/26",
      startDate: new Date("2025-07-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
    team: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getGroupedWochenplan — Europe/Zurich date grouping", () => {

  it("E1: summer UTC event at 22:15 UTC (=00:15 Zurich+2) groups to next Swiss day", async () => {
    // 2026-07-23T22:15:00Z = 2026-07-24 00:15:00 CEST (UTC+2)
    // Server UTC sees this as July 23; Swiss local date is July 24.
    const startAt = new Date("2026-07-23T22:15:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-07-24");
  });

  it("E2: winter UTC event at 23:15 UTC (=00:15 Zurich+1) groups to next Swiss day", async () => {
    // 2026-01-15T23:15:00Z = 2026-01-16 00:15:00 CET (UTC+1)
    // Server UTC sees this as Jan 15; Swiss local date is Jan 16.
    const startAt = new Date("2026-01-15T23:15:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-01-16");
  });

  it("E3: mid-day event (10:00 UTC = 12:00 Zurich) groups to the correct date", async () => {
    // 2026-07-23T10:00:00Z = 2026-07-23 12:00:00 CEST — same date in both UTC and Zurich.
    const startAt = new Date("2026-07-23T10:00:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-07-23");
  });

  it("E4: weekday label matches Europe/Zurich local date (2026-07-24 is Freitag)", async () => {
    // 2026-07-23T22:15:00Z → 2026-07-24 in Zurich, which is a Friday (Freitag).
    const startAt = new Date("2026-07-23T22:15:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    // Friday in German (de-CH).
    expect(days[0].weekdayLabel.toLowerCase()).toContain("freitag");
  });

  it("E4b: weekday label for a winter Thursday is 'Donnerstag'", async () => {
    // 2026-01-15T23:15:00Z → 2026-01-16 in Zurich.
    // Jan 16 2026 is a Friday — let's use Jan 22 instead.
    // 2026-01-21T23:15:00Z = 2026-01-22 00:15 CET. Jan 22 2026 is a Thursday.
    const startAt = new Date("2026-01-21T23:15:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days[0].weekdayLabel.toLowerCase()).toContain("donnerstag");
  });

  it("E5: calendar week is computed from Zurich local date", async () => {
    // 2026-07-23T22:15:00Z → 2026-07-24 Zurich.
    // 2026-07-24 falls in ISO week 30 (Mon 2026-07-20 – Sun 2026-07-26).
    const startAt = new Date("2026-07-23T22:15:00.000Z");
    mocks.eventFindMany.mockResolvedValue([makeWochenplanRow(startAt)]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days[0].calendarWeek).toBe(30);
  });

  it("two events with the same Zurich local date are grouped together", async () => {
    // Both events are on the UTC evening of July 23 → same Swiss day July 24.
    const e1 = makeWochenplanRow(new Date("2026-07-23T22:00:00.000Z"));
    const e2 = { ...makeWochenplanRow(new Date("2026-07-23T22:30:00.000Z")), id: "evt-wp-2", title: "Training B" };
    mocks.eventFindMany.mockResolvedValue([e1, e2]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-07-24");
    expect(days[0].events).toHaveLength(2);
  });

  it("events on different Zurich local dates are in separate groups", async () => {
    // July 23 morning UTC → stays July 23 in Zurich.
    const e1 = makeWochenplanRow(new Date("2026-07-23T10:00:00.000Z"));
    // July 23 evening UTC → crosses to July 24 in Zurich.
    const e2 = { ...makeWochenplanRow(new Date("2026-07-23T22:15:00.000Z")), id: "evt-wp-2" };
    mocks.eventFindMany.mockResolvedValue([e1, e2]);

    const days = await getGroupedWochenplan({ tenantId: "t1" });

    expect(days).toHaveLength(2);
    const dates = days.map((d) => d.date);
    expect(dates).toContain("2026-07-23");
    expect(dates).toContain("2026-07-24");
  });
});
