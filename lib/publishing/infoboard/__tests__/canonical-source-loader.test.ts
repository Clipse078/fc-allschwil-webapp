/**
 * lib/publishing/infoboard/__tests__/canonical-source-loader.test.ts
 *
 * INFOBOARD-INTEGRATION-01A — focused tests for
 * createCanonicalInfoboardSourceLoader.
 *
 * getWeekplannerDay() / getOperationalWeekplannerPlan() are mocked so this
 * file proves the LOADER's wiring/mapping contract in isolation:
 *   - canonical operational resolution (Standardplan vs. active alternative,
 *     never the viewer's `?plan=`, never an archived plan)
 *   - TRAINING cutover (no legacy Event query, no duplication)
 *   - MATCH/TOURNAMENT publication-policy metadata pass-through
 *   - tenant isolation on every query
 *   - Europe/Zurich calendar-day enumeration
 *
 * End-to-end parity with the REAL getWeekplannerDay/getOperationalWeekplannerPlan
 * (Standardplan + alternative-plan example scenarios, Europe/Zurich day
 * boundary) is covered separately in
 * canonical-source-loader.integration.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getWeekplannerDay: vi.fn(),
  getOperationalWeekplannerPlan: vi.fn(),
}));

vi.mock("@/lib/weekplanner/queries", () => ({
  getWeekplannerDay: mocks.getWeekplannerDay,
}));
vi.mock("@/lib/weekplanner/plan-service", () => ({
  getOperationalWeekplannerPlan: mocks.getOperationalWeekplannerPlan,
}));

import { createCanonicalInfoboardSourceLoader } from "../canonical-source-loader";
import type {
  CanonicalInfoboardPolicyDatabase,
  CanonicalEventPolicyRow,
  CanonicalTrainingSessionPolicyRow,
} from "../canonical-source-loader";
import type {
  WeekplannerDay,
  WeekplannerMatchItem,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
} from "@/lib/weekplanner/types";
import { evaluatePublication } from "../../policy/publication-policy";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-fca";
const TENANT_B = "tenant-other";

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:session-1",
    tenantId: TENANT_A,
    type: "TRAINING",
    startAt: new Date("2026-08-10T15:00:00.000Z"),
    endAt: new Date("2026-08-10T16:00:00.000Z"),
    canonicalStartAt: new Date("2026-08-10T15:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-10T16:00:00.000Z"),
    timeOverridden: false,
    title: "E2 Training",
    teamNames: ["E2"],
    pitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Im Brüel" }],
    dressingRoomAllocations: [{ facilityResourceId: "res-g3", code: "G3", name: "Kabine 3", facilityName: "Im Brüel" }],
    canonicalPitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Im Brüel" }],
    canonicalDressingRoomAllocations: [{ facilityResourceId: "res-g3", code: "G3", name: "Kabine 3", facilityName: "Im Brüel" }],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-1",
    trainingSessionId: "session-1",
    ...overrides,
  };
}

function matchItem(overrides: Partial<WeekplannerMatchItem> = {}): WeekplannerMatchItem {
  return {
    id: "match:event-1",
    tenantId: TENANT_A,
    type: "MATCH",
    startAt: new Date("2026-08-15T13:00:00.000Z"),
    endAt: new Date("2026-08-15T14:30:00.000Z"),
    canonicalStartAt: new Date("2026-08-15T13:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-15T14:30:00.000Z"),
    timeOverridden: false,
    title: "FC Allschwil 1 - Gegner FC",
    teamNames: ["FC Allschwil 1"],
    opponentName: "Gegner FC",
    homeAway: "HOME",
    eventId: "event-1",
    pitchAllocations: [{ facilityResourceId: "res-kr2", code: "KR2", name: "Kunstrasen 2", facilityName: "Im Brüel" }],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    awayDressingRoomAllocations: [],
    conflicts: [],
    ...overrides,
  };
}

function tournamentItem(overrides: Partial<WeekplannerTournamentItem> = {}): WeekplannerTournamentItem {
  return {
    id: "tournament:event-2",
    tenantId: TENANT_A,
    type: "TOURNAMENT",
    startAt: new Date("2026-08-15T08:00:00.000Z"),
    endAt: new Date("2026-08-15T16:00:00.000Z"),
    canonicalStartAt: new Date("2026-08-15T08:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-15T16:00:00.000Z"),
    timeOverridden: false,
    title: "FCA Sommerturnier",
    teamNames: ["FC Allschwil E1"],
    homeAway: "HOME",
    eventId: "event-2",
    pitchAllocations: [],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    participantAllocations: [],
    conflicts: [],
    ...overrides,
  };
}

function eventPolicyRow(overrides: Partial<CanonicalEventPolicyRow> = {}): CanonicalEventPolicyRow {
  return {
    id: "event-1",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    homeAway: "HOME",
    organizerName: null,
    competitionLabel: "3. Liga",
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    season: { key: "2026-2027" },
    ...overrides,
  };
}

function trainingPolicyRow(
  overrides: Partial<CanonicalTrainingSessionPolicyRow> = {},
): CanonicalTrainingSessionPolicyRow {
  return {
    id: "session-1",
    status: "SCHEDULED",
    teamSeason: {
      season: { key: "2026-2027" },
      team: {
        name: "E2",
        shortName: null,
        alternativeName: null,
        infoboardDisplayName: null,
      },
    },
    ...overrides,
  };
}

function makeDay(items: WeekplannerDay["items"], dayKey = "2026-08-10"): WeekplannerDay {
  return { dayKey, items };
}

function makeDatabase(
  eventRows: CanonicalEventPolicyRow[] = [],
  trainingRows: CanonicalTrainingSessionPolicyRow[] = [],
): CanonicalInfoboardPolicyDatabase & {
  event: { findMany: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
} {
  return {
    event: { findMany: vi.fn().mockResolvedValue(eventRows) },
    trainingSession: { findMany: vi.fn().mockResolvedValue(trainingRows) },
  };
}

const DATE_FROM = new Date("2026-08-10T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
  mocks.getWeekplannerDay.mockResolvedValue(makeDay([]));
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Canonical operational resolution ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("canonical operational resolution", () => {
  it("1. no active alternative plan -> resolves Standardplan (undefined planId)", async () => {
    mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase());

    await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(mocks.getWeekplannerDay).toHaveBeenCalledTimes(1);
    const [, , planId] = mocks.getWeekplannerDay.mock.calls[0];
    expect(planId).toBeUndefined();
  });

  it("2. active alternative plan -> resource override reaches Infoboard (pass-through)", async () => {
    mocks.getOperationalWeekplannerPlan.mockResolvedValue({ id: "plan-alt", tenantId: TENANT_A, weekId: "2026-08-10", name: "Schlechtwetterplan", createdByUserId: null, createdAt: "", updatedAt: "", archivedAt: null, isActive: true });
    const overriddenItem = trainingItem({
      pitchAllocations: [{ facilityResourceId: "res-halle1", code: "HALLE1", name: "Halle 1", facilityName: "Im Brüel" }],
      pitchOverridden: true,
    });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([overriddenItem]));

    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));
    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(mocks.getWeekplannerDay.mock.calls[0][2]).toBe("plan-alt");
    expect(events[0].pitch).toEqual({ label: null, code: "HALLE1", name: "Halle 1", facilityName: "Im Brüel" });
  });

  it("3. active alternative plan -> time override reaches Infoboard (pass-through)", async () => {
    mocks.getOperationalWeekplannerPlan.mockResolvedValue({ id: "plan-alt", tenantId: TENANT_A, weekId: "2026-08-10", name: "Schlechtwetterplan", createdByUserId: null, createdAt: "", updatedAt: "", archivedAt: null, isActive: true });
    const overriddenItem = trainingItem({
      startAt: new Date("2026-08-10T16:00:00.000Z"),
      endAt: new Date("2026-08-10T17:00:00.000Z"),
      canonicalStartAt: new Date("2026-08-10T15:00:00.000Z"),
      canonicalEndAt: new Date("2026-08-10T16:00:00.000Z"),
      timeOverridden: true,
    });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([overriddenItem]));

    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));
    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(events[0].startAt.toISOString()).toBe("2026-08-10T16:00:00.000Z");
    expect(events[0].endAt?.toISOString()).toBe("2026-08-10T17:00:00.000Z");
  });

  it("4. changing the operationally active plan changes the resolved Infoboard state", async () => {
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));

    mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    const standardResult = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(standardResult[0].pitch?.code).toBe("KR2");

    mocks.getOperationalWeekplannerPlan.mockResolvedValue({ id: "plan-b", tenantId: TENANT_A, weekId: "2026-08-10", name: "Plan B", createdByUserId: null, createdAt: "", updatedAt: "", archivedAt: null, isActive: true });
    mocks.getWeekplannerDay.mockResolvedValue(
      makeDay([trainingItem({ pitchAllocations: [{ facilityResourceId: "res-halle1", code: "HALLE1", name: "Halle 1", facilityName: "Im Brüel" }] })]),
    );
    const altResult = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(altResult[0].pitch?.code).toBe("HALLE1");

    expect(mocks.getWeekplannerDay.mock.calls[0][2]).toBeUndefined();
    expect(mocks.getWeekplannerDay.mock.calls[1][2]).toBe("plan-b");
  });

  it("5. viewing another plan (an unrelated `plan` query param) never influences resolution", async () => {
    mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));

    // PublicationEventLoadInput has no "plan" concept at all — simulate a
    // caller mistake attaching one; the loader must never read it.
    await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM, ...( { plan: "viewer-selected-plan" } as Record<string, unknown>) });

    expect(mocks.getWeekplannerDay.mock.calls[0][2]).toBeUndefined();
    expect(mocks.getOperationalWeekplannerPlan).toHaveBeenCalledWith(TENANT_A, expect.any(String));
  });

  it("6. an archived plan can never influence Infoboard — getOperationalWeekplannerPlan's null contract is trusted as-is", async () => {
    // Per plan-service.ts#getOperationalWeekplannerPlan's own contract, an
    // archived plan is NEVER returned (archivedAt: null is enforced at the
    // query level) — this loader does not re-implement that check; it only
    // ever branches on null vs. a plan, so archival safety is inherited for
    // free from the single canonical resolver.
    mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase());
    await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(mocks.getWeekplannerDay.mock.calls[0][2]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── TRAINING cutover ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("TRAINING cutover", () => {
  it("7. a canonical TrainingSession reaches Infoboard without any legacy Event(TRAINING) query", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    const database = makeDatabase([], [trainingPolicyRow()]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("TRAINING");
    expect(events[0].infoboardVisible).toBe(true);
    // No MATCH/TOURNAMENT ids exist in this day -> the Event policy table is
    // never queried at all.
    expect(database.event.findMany).not.toHaveBeenCalled();
  });

  it("8. canonical training never produces a duplicate even when a legacy training-shaped Event row exists", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    // A legacy Event(type=TRAINING) row for the "same" real-world training
    // may still exist in the DB — it is simply never read by this loader.
    const database = makeDatabase(
      [eventPolicyRow({ id: "legacy-event-training-1" })],
      [trainingPolicyRow()],
    );
    const loader = createCanonicalInfoboardSourceLoader(database);

    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(events).toHaveLength(1);
    expect(database.event.findMany).not.toHaveBeenCalled();
  });

  it("cancelled TrainingSession status is preserved through to publication status", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    const database = makeDatabase([], [trainingPolicyRow({ status: "CANCELLED" })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(events[0].status).toBe("CANCELLED");
  });

  it("maps every effective training dressing-room allocation for Screen 1", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(
      makeDay([
        trainingItem({
          dressingRoomAllocations: [
            { facilityResourceId: "res-e1", code: "E1", name: "Kabine E1", facilityName: "Im Brüel" },
            { facilityResourceId: "res-o3", code: "O3", name: "Kabine O3", facilityName: "Im Brüel" },
          ],
        }),
      ]),
    );
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));
    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.homeDressingRooms).toEqual([
      { label: null, code: "E1", name: "Kabine E1", facilityName: "Im Brüel" },
      { label: null, code: "O3", name: "Kabine O3", facilityName: "Im Brüel" },
    ]);
    expect(event.homeDressingRoomCodes).toEqual(["E1", "O3"]);
  });

  it("preserves occurrence override dressing rooms without series rooms", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(
      makeDay([
        trainingItem({
          dressingRoomOverridden: true,
          dressingRoomAllocations: [
            { facilityResourceId: "res-e3", code: "E3", name: "Kabine E3", facilityName: "Im Brüel" },
          ],
          canonicalDressingRoomAllocations: [
            { facilityResourceId: "res-e1", code: "E1", name: "Kabine E1", facilityName: "Im Brüel" },
            { facilityResourceId: "res-o3", code: "O3", name: "Kabine O3", facilityName: "Im Brüel" },
          ],
        }),
      ]),
    );
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));
    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.homeDressingRooms).toEqual([
      { label: null, code: "E3", name: "Kabine E3", facilityName: "Im Brüel" },
    ]);
    expect(event.homeDressingRoom?.code).toBe("E3");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── MATCH / TOURNAMENT publication-policy metadata ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("MATCH / TOURNAMENT publication-policy metadata pass-through", () => {
  it("9. a visible HOME match remains eligible through the unmodified publication policy", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", homeAway: "HOME", infoboardVisible: true })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });

  it("10a. an AWAY match's raw homeAway is preserved and excluded by policy even though Weekplanner itself only surfaces HOME", async () => {
    // Weekplanner's own HOME/AWAY filter is permissive ("not AWAY" counts as
    // home) — the loader deliberately re-reads the STRICT raw Event.homeAway
    // value for policy purposes so AWAY / blank / NEUTRAL keep being
    // excluded exactly like before the canonical cutover.
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", homeAway: "AWAY" })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: false, reason: "AWAY_MATCH" });
  });

  it("10b. a blank/neutral raw homeAway is excluded as HOME_AWAY_UNKNOWN", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", homeAway: null })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: false, reason: "HOME_AWAY_UNKNOWN" });
  });

  it("11. a visible HOME tournament remains eligible through the unmodified publication policy", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([tournamentItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-2", infoboardVisible: true })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(event.type).toBe("TOURNAMENT");
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: true, reason: "ELIGIBLE" });
  });

  it("12a. a match with infoboardVisible=false is excluded (hidden activity)", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", infoboardVisible: false })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: false, reason: "INFOBOARD_HIDDEN" });
  });

  it("12b. a cancelled match is excluded (non-publishable status)", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", status: "CANCELLED" })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision).toEqual({ eligible: false, reason: "STATUS_NOT_PUBLISHABLE" });
  });

  it("fails closed (never defaults to visible) when no policy row is found for a resolved eventId", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([]); // no matching row for event-1
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(event.infoboardVisible).toBe(false);
    const decision = evaluatePublication(event, "INFOBOARD_SCREEN_1", TENANT_A);
    expect(decision.eligible).toBe(false);
  });

  it("carries organizerName/competitionLabel/meetingTime/resultLabel through from Event policy metadata", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const meetingTime = new Date("2026-08-15T12:30:00.000Z");
    const database = makeDatabase([
      eventPolicyRow({
        id: "event-1",
        organizerName: "FC Allschwil",
        competitionLabel: "3. Liga",
        meetingTime,
        resultLabel: "2:1",
        intermediateResultLabel: "1:0 (HZ)",
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(event.organizerName).toBe("FC Allschwil");
    expect(event.competitionLabel).toBe("3. Liga");
    expect(event.meetingTime).toEqual(meetingTime);
    expect(event.resultLabel).toBe("2:1");
    expect(event.intermediateResultLabel).toBe("1:0 (HZ)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Tenant isolation ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("13. tenant isolation", () => {
  it("scopes getOperationalWeekplannerPlan/getWeekplannerDay by the caller-supplied tenantId", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([]));
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase());

    await loader({ tenantId: TENANT_B, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(mocks.getOperationalWeekplannerPlan).toHaveBeenCalledWith(TENANT_B, expect.any(String));
    expect(mocks.getWeekplannerDay.mock.calls[0][0]).toBe(TENANT_B);
  });

  it("scopes every policy-metadata query by tenantId", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem({ tenantId: TENANT_B })], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1" })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    await loader({ tenantId: TENANT_B, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    const call = database.event.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe(TENANT_B);
  });

  it("tenant A's resolved activities never leak into a tenant B request (loader never mixes tenantIds across calls)", async () => {
    mocks.getOperationalWeekplannerPlan.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === TENANT_A ? { id: "plan-a", tenantId: TENANT_A, weekId: "2026-08-10", name: "A", createdByUserId: null, createdAt: "", updatedAt: "", archivedAt: null, isActive: true } : null),
    );
    mocks.getWeekplannerDay.mockImplementation((tenantId: string) =>
      Promise.resolve(makeDay(tenantId === TENANT_A ? [trainingItem({ tenantId: TENANT_A })] : [])),
    );
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));

    const tenantBEvents = await loader({ tenantId: TENANT_B, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(tenantBEvents).toHaveLength(0);

    const tenantAEvents = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(tenantAEvents).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Conflicts / robustness ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("16. existing conflict annotations do not block mapping", () => {
  it("maps an item carrying resource conflicts without error, ignoring the conflicts field", async () => {
    const conflicted = trainingItem({
      conflicts: [{ facilityResourceId: "res-kr2", facilityResourceName: "Kunstrasen 2" }],
    });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([conflicted]));
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase([], [trainingPolicyRow()]));

    const events = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });
    expect(events).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── INFOBOARD-C1: null-season regression (Event.season nullable after
//    ADMIN-DELETE-SEASON-01-C1 permanent Season deletion) ────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("INFOBOARD-C1 — Event with season=null does not crash the loader", () => {
  it("MATCH with season=null in policy row: maps without error, seasonKey defaults to empty string", async () => {
    const item = matchItem({ eventId: "event-null-season" });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([item], "2026-08-15"));

    const policyWithNullSeason = eventPolicyRow({
      id: "event-null-season",
      season: null,
    });
    const database = makeDatabase([policyWithNullSeason]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    let events: Awaited<ReturnType<typeof loader>>;
    expect(
      () =>
        (events = [] as typeof events),
    ).not.toThrow();

    events = await loader({
      tenantId: TENANT_A,
      dateFrom: new Date("2026-08-15T00:00:00.000Z"),
      dateTo: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(events).toHaveLength(1);
    expect(events[0].seasonKey).toBe("");
  });

  it("TOURNAMENT with season=null in policy row: maps without error, seasonKey defaults to empty string", async () => {
    const item = tournamentItem({ eventId: "event-null-season-t" });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([item], "2026-08-15"));

    const policyWithNullSeason = eventPolicyRow({
      id: "event-null-season-t",
      season: null,
    });
    const database = makeDatabase([policyWithNullSeason]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const events = await loader({
      tenantId: TENANT_A,
      dateFrom: new Date("2026-08-15T00:00:00.000Z"),
      dateTo: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(events).toHaveLength(1);
    expect(events[0].seasonKey).toBe("");
  });

  it("MATCH with season present: seasonKey is preserved unchanged (non-regression)", async () => {
    const item = matchItem({ eventId: "event-with-season" });
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([item], "2026-08-15"));

    const policyWithSeason = eventPolicyRow({
      id: "event-with-season",
      season: { key: "2026-2027" },
    });
    const database = makeDatabase([policyWithSeason]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const events = await loader({
      tenantId: TENANT_A,
      dateFrom: new Date("2026-08-15T00:00:00.000Z"),
      dateTo: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(events).toHaveLength(1);
    expect(events[0].seasonKey).toBe("2026-2027");
  });
});

describe("MATCHCENTER-CANONICAL-OPPONENT-01B — match identity propagation", () => {
  it("propagates a manually-created canonical opponent club logo to Infoboard identity", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([
      eventPolicyRow({
        id: "event-1",
        homeAway: "HOME",
        opponentExternalClub: {
          name: "FC Telegraph",
          shortName: null,
          alternativeName: null,
          logoUrl: "https://cdn.example.com/telegraph.png",
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.opponentLogoUrl).toBe("https://cdn.example.com/telegraph.png");
    expect(event.matchIdentity?.away.clubName).toBe("FC Telegraph");
    expect(event.matchIdentity?.away.clubLogoUrl).toBe("https://cdn.example.com/telegraph.png");
  });

  it("keeps display override text-only while logo remains canonical club identity", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(
      makeDay([matchItem({ opponentName: "FC Telegraph E1" })], "2026-08-15"),
    );
    const database = makeDatabase([
      eventPolicyRow({
        id: "event-1",
        homeAway: "HOME",
        opponentExternalClub: {
          name: "FC Telegraph",
          shortName: null,
          alternativeName: null,
          logoUrl: "https://cdn.example.com/telegraph.png",
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.matchIdentity?.away.fallbackDisplayName).toBe("FC Telegraph E1");
    expect(event.matchIdentity?.away.clubName).toBe("FC Telegraph");
    expect(event.matchIdentity?.away.clubLogoUrl).toBe("https://cdn.example.com/telegraph.png");
  });

  it("keeps legacy free-text matches safe without fabricating club identity", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([eventPolicyRow({ id: "event-1", homeAway: "HOME" })]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.opponentLogoUrl).toBeNull();
    expect(event.matchIdentity?.away.clubName).toBeNull();
    expect(event.matchIdentity?.away.fallbackDisplayName).toBe("Gegner FC");
  });

  it("still prefers provider ExternalTeam mapping over Event.opponentExternalClub", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([matchItem()], "2026-08-15"));
    const database = makeDatabase([
      eventPolicyRow({
        id: "event-1",
        homeAway: "HOME",
        opponentExternalClub: {
          name: "FC Telegraph",
          shortName: null,
          alternativeName: null,
          logoUrl: "https://cdn.example.com/telegraph.png",
        },
        matchExternalMapping: {
          homeTeam: null,
          awayTeam: null,
          homeExternalTeam: null,
          awayExternalTeam: {
            name: "SV Muttenz Erste Mannschaft",
            shortName: "1M",
            alternativeName: null,
            logoUrl: null,
            externalClub: {
              name: "SV Muttenz",
              shortName: null,
              logoUrl: "https://cdn.example.com/muttenz.png",
            },
          },
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DATE_FROM, dateTo: DATE_FROM });

    expect(event.opponentLogoUrl).toBe("https://cdn.example.com/muttenz.png");
    expect(event.matchIdentity?.away.clubName).toBe("SV Muttenz");
    expect(event.matchIdentity?.away.teamName).toBe("SV Muttenz Erste Mannschaft");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Europe/Zurich day enumeration ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("17. Europe/Zurich calendar-day enumeration", () => {
  it("resolves one calendar day when dateFrom/dateTo fall on the same Europe/Zurich day", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([]));
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase());

    // 2026-08-10T22:30:00Z is 2026-08-11T00:30 Europe/Zurich (CEST, UTC+2) —
    // both bounds fall on the SAME Zurich calendar day (2026-08-11).
    await loader({
      tenantId: TENANT_A,
      dateFrom: new Date("2026-08-10T22:30:00.000Z"),
      dateTo: new Date("2026-08-10T23:30:00.000Z"),
    });

    expect(mocks.getWeekplannerDay).toHaveBeenCalledTimes(1);
    expect(mocks.getWeekplannerDay.mock.calls[0][1].date).toBe("2026-08-11");
  });

  it("resolves every Europe/Zurich calendar day spanned by a multi-day window (Screen 1's 26h/48h buffer)", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([]));
    const loader = createCanonicalInfoboardSourceLoader(makeDatabase());

    // now-26h .. now+48h around 2026-08-11T12:00 Europe/Zurich spans 3 days.
    await loader({
      tenantId: TENANT_A,
      dateFrom: new Date("2026-08-10T08:00:00.000Z"),
      dateTo: new Date("2026-08-13T08:00:00.000Z"),
    });

    const resolvedDates = mocks.getWeekplannerDay.mock.calls.map((call: unknown[]) => (call[1] as { date: string }).date);
    expect(resolvedDates).toEqual(["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"]);
  });
});
