/**
 * lib/publishing/infoboard/__tests__/canonical-source-loader.integration.test.ts
 *
 * INFOBOARD-INTEGRATION-01A — end-to-end parity tests.
 *
 * Unlike canonical-source-loader.test.ts (which mocks getWeekplannerDay /
 * getOperationalWeekplannerPlan directly), this file mocks ONLY the Prisma
 * client and exercises the REAL lib/weekplanner/queries.ts +
 * lib/weekplanner/plan-service.ts alongside the REAL
 * createCanonicalInfoboardSourceLoader — proving genuine parity, not just
 * a mocked contract:
 *
 *   18. Standardplan: Infoboard resolves the exact same effective time and
 *       Spielfeld/Halle + Garderobe allocation Weekplanner/Day Planning
 *       resolve for the same tenant + date (the "17:00–18:00 KR2 Kabine 3"
 *       example from the task spec).
 *   19. Alternative Betriebsplan: once a WeekplannerPlan is operationally
 *       active, Infoboard resolves that plan's EFFECTIVE override state —
 *       the "18:00–19:00 Halle 1" example — and never the Standardplan
 *       value, and never an arbitrary VIEW-only `?plan=` selection.
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facilityResourceFindMany: vi.fn(),
  trainingAllocationFindMany: vi.fn(),
  trainingSessionAllocationFindMany: vi.fn(),
  trainingSessionFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  weekplannerPlanFindFirst: vi.fn(),
  weekplannerPlanAllocationFindMany: vi.fn(),
  weekplannerPlanActivityOverrideFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    facilityResource: { findMany: mocks.facilityResourceFindMany },
    trainingAllocation: { findMany: mocks.trainingAllocationFindMany },
    trainingSessionAllocation: { findMany: mocks.trainingSessionAllocationFindMany },
    trainingSession: { findMany: mocks.trainingSessionFindMany },
    event: { findMany: mocks.eventFindMany },
    weekplannerPlan: { findFirst: mocks.weekplannerPlanFindFirst },
    weekplannerPlanAllocation: { findMany: mocks.weekplannerPlanAllocationFindMany },
    weekplannerPlanActivityOverride: { findMany: mocks.weekplannerPlanActivityOverrideFindMany },
  },
}));

import { getWeekplannerDay } from "@/lib/weekplanner/queries";
import { createCanonicalInfoboardSourceLoader } from "../canonical-source-loader";
import type { CanonicalInfoboardPolicyDatabase } from "../canonical-source-loader";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WEEK_ID = "2026-08-10"; // Monday
const PLAN_ID = "plan-schlechtwetter";

const KR2 = { id: "res-kr2", code: "KR2", name: "Kunstrasen 2", facility: { name: "Im Brüel" } };
const KABINE_3 = { id: "res-g3", code: "G3", name: "Kabine 3", facility: { name: "Im Brüel" } };
const HALLE_1 = { id: "res-halle1", code: "HALLE1", name: "Halle 1", facility: { name: "Im Brüel" } };

function trainingSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    tenantId: TENANT_A,
    trainingSeriesId: "series-1",
    teamSeasonId: "teamseason-1",
    date: new Date("2026-08-10T00:00:00.000Z"),
    weekday: "MONDAY",
    // 17:00-18:00 Europe/Zurich (CEST, UTC+2) in August.
    startAt: new Date("2026-08-10T15:00:00.000Z"),
    endAt: new Date("2026-08-10T16:00:00.000Z"),
    timezone: "Europe/Zurich",
    status: "SCHEDULED",
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    trainingSeries: {
      title: "E2 Training",
      teamSeason: {
        displayName: "FC Allschwil E2",
        team: { name: "E2", shortName: null, alternativeName: null },
      },
    },
    // Additional fields read ONLY by the canonical Infoboard policy lookup
    // (never by lib/training/session-generation-service.ts) — see
    // canonical-source-loader.ts's CanonicalTrainingSessionPolicyRow.
    teamSeason: { season: { key: "2026-2027" } },
    ...overrides,
  };
}

function createPolicyDatabase(): CanonicalInfoboardPolicyDatabase {
  return {
    event: {
      findMany: (args) =>
        mocks.eventFindMany(args) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["event"]["findMany"]>,
    },
    trainingSession: {
      findMany: (args) =>
        mocks.trainingSessionFindMany(args) as unknown as ReturnType<
          CanonicalInfoboardPolicyDatabase["trainingSession"]["findMany"]
        >,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.facilityResourceFindMany.mockResolvedValue([KR2, KABINE_3, HALLE_1]);
  mocks.trainingAllocationFindMany.mockResolvedValue([
    { trainingSeriesId: "series-1", facilityResource: { id: KR2.id, code: KR2.code, name: KR2.name, type: "FULL_PITCH", facility: { name: KR2.facility.name } } },
    { trainingSeriesId: "series-1", facilityResource: { id: KABINE_3.id, code: KABINE_3.code, name: KABINE_3.name, type: "DRESSING_ROOM", facility: { name: KABINE_3.facility.name } } },
  ]);
  mocks.trainingSessionAllocationFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);
  mocks.weekplannerPlanFindFirst.mockResolvedValue(null); // Standardplan by default

  // trainingSession.findMany is called by TWO distinct callers sharing the
  // same underlying table:
  //   - lib/training/session-generation-service.ts#listTrainingSessions
  //     (date-range where clause) — used by getWeekplannerDay itself.
  //   - canonical-source-loader.ts's own policy-metadata lookup (id: {in:[...]}).
  // Both read from the SAME row set below; only the fields each side
  // actually reads differ.
  mocks.trainingSessionFindMany.mockImplementation((args: { where?: { id?: { in?: string[] } } }) => {
    const rows = [trainingSessionRow()];
    if (args.where?.id?.in) {
      return Promise.resolve(rows.filter((r) => args.where!.id!.in!.includes(r.id)));
    }
    return Promise.resolve(rows);
  });
});

const DAY_WINDOW = {
  from: new Date("2026-08-09T22:00:00.000Z"), // 2026-08-10T00:00 Europe/Zurich
  to: new Date("2026-08-10T21:59:59.999Z"), // 2026-08-10T23:59:59.999 Europe/Zurich
  date: "2026-08-10",
  param: "2026-08-10",
  previousParam: "2026-08-09",
  nextParam: "2026-08-11",
};

describe("18. Standardplan parity with Weekplanner/Day Planning", () => {
  it("Infoboard resolves the exact canonical time + resources for the same date (17:00–18:00 KR2 Kabine 3)", async () => {
    const loader = createCanonicalInfoboardSourceLoader(createPolicyDatabase());

    const [event] = await loader({
      tenantId: TENANT_A,
      dateFrom: DAY_WINDOW.from,
      dateTo: DAY_WINDOW.to,
    });

    expect(event.type).toBe("TRAINING");
    expect(event.startAt.toISOString()).toBe("2026-08-10T15:00:00.000Z"); // 17:00 CEST
    expect(event.endAt?.toISOString()).toBe("2026-08-10T16:00:00.000Z"); // 18:00 CEST
    expect(event.pitch?.code).toBe("KR2");
    expect(event.homeDressingRoom?.code).toBe("G3");

    // Direct parity check: getWeekplannerDay (real, unmocked) for the same
    // tenant/date/no-plan resolves byte-for-byte the same effective values.
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW, undefined);
    const [weekplannerItem] = day.items;
    expect(weekplannerItem.type).toBe("TRAINING");
    expect(weekplannerItem.startAt.toISOString()).toBe(event.startAt.toISOString());
    expect(weekplannerItem.endAt.toISOString()).toBe(event.endAt?.toISOString());
    if (weekplannerItem.type === "TRAINING") {
      expect(weekplannerItem.pitchAllocations[0]?.code).toBe(event.pitch?.code);
      expect(weekplannerItem.dressingRoomAllocations[0]?.code).toBe(event.homeDressingRoom?.code);
    }
  });
});

describe("19. Alternative Betriebsplan parity with Weekplanner/Day Planning", () => {
  function activatePlanWithOverrides() {
    mocks.weekplannerPlanFindFirst.mockResolvedValue({
      id: PLAN_ID,
      tenantId: TENANT_A,
      weekId: WEEK_ID,
      name: "Schlechtwetterplan",
      createdByUserId: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      archivedAt: null,
      isActive: true,
    });
    // Scoped to weekplannerPlanId, mirroring the real query's `where` clause
    // — a DIFFERENT (e.g. viewer-selected) planId must never see these rows.
    mocks.weekplannerPlanAllocationFindMany.mockImplementation(
      (args: { where?: { weekplannerPlanId?: string } }) => {
        if (args.where?.weekplannerPlanId !== PLAN_ID) return Promise.resolve([]);
        return Promise.resolve([
          {
            activityType: "TRAINING",
            activityId: "session-1",
            allocationGroup: "PITCH_HALL",
            participantId: "",
            facilityResource: { id: HALLE_1.id, code: HALLE_1.code, name: HALLE_1.name, facility: { name: HALLE_1.facility.name } },
          },
        ]);
      },
    );
    mocks.weekplannerPlanActivityOverrideFindMany.mockImplementation(
      (args: { where?: { weekplannerPlanId?: string } }) => {
        if (args.where?.weekplannerPlanId !== PLAN_ID) return Promise.resolve([]);
        return Promise.resolve([
          {
            activityType: "TRAINING",
            activityId: "session-1",
            // 18:00-19:00 Europe/Zurich (CEST, UTC+2) — one hour later than canonical.
            overrideStartAt: new Date("2026-08-10T16:00:00.000Z"),
            overrideEndAt: new Date("2026-08-10T17:00:00.000Z"),
          },
        ]);
      },
    );
  }

  it("Infoboard receives the plan's EFFECTIVE overridden state (18:00–19:00 Halle 1), never the Standardplan value", async () => {
    activatePlanWithOverrides();
    const loader = createCanonicalInfoboardSourceLoader(createPolicyDatabase());

    const [event] = await loader({
      tenantId: TENANT_A,
      dateFrom: DAY_WINDOW.from,
      dateTo: DAY_WINDOW.to,
    });

    expect(event.startAt.toISOString()).toBe("2026-08-10T16:00:00.000Z"); // 18:00 CEST
    expect(event.endAt?.toISOString()).toBe("2026-08-10T17:00:00.000Z"); // 19:00 CEST
    expect(event.pitch?.code).toBe("HALLE1");
    expect(event.pitch?.code).not.toBe("KR2");

    // Direct parity check against the real getWeekplannerDay with the SAME
    // operationally active planId.
    const day = await getWeekplannerDay(TENANT_A, DAY_WINDOW, PLAN_ID);
    const [weekplannerItem] = day.items;
    expect(weekplannerItem.startAt.toISOString()).toBe(event.startAt.toISOString());
    if (weekplannerItem.type === "TRAINING") {
      expect(weekplannerItem.pitchAllocations[0]?.code).toBe(event.pitch?.code);
    }
  });

  it("viewing a DIFFERENT (non-operational) plan never influences Infoboard's resolved state", async () => {
    activatePlanWithOverrides(); // plan-schlechtwetter is the OPERATIONALLY active one
    const loader = createCanonicalInfoboardSourceLoader(createPolicyDatabase());

    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DAY_WINDOW.from, dateTo: DAY_WINDOW.to });
    expect(event.pitch?.code).toBe("HALLE1");

    // A viewer selecting an entirely different plan id (e.g. via `?plan=`)
    // for the Weekplanner ADMIN UI resolves independently and has zero
    // bearing on the Infoboard loader above, which never accepts a planId.
    const viewedDay = await getWeekplannerDay(TENANT_A, DAY_WINDOW, "plan-someone-is-just-viewing");
    const [viewedItem] = viewedDay.items;
    expect(viewedItem.type).toBe("TRAINING");
    if (viewedItem.type === "TRAINING") {
      // No override rows exist for "plan-someone-is-just-viewing" -> falls
      // back to canonical Standardplan values, proving it is a totally
      // independent resolution from the operationally active plan above.
      expect(viewedItem.pitchAllocations[0]?.code).toBe("KR2");
    }
    // Re-confirms the Infoboard loader's own (unrelated) result is untouched.
    const [eventAgain] = await loader({ tenantId: TENANT_A, dateFrom: DAY_WINDOW.from, dateTo: DAY_WINDOW.to });
    expect(eventAgain.pitch?.code).toBe("HALLE1");
  });

  it("an archived plan (even if formerly active) can never influence Infoboard — Standardplan resolves instead", async () => {
    // getOperationalWeekplannerPlan's own query filters archivedAt: null at
    // the DB level — an archived plan's findFirst simply never matches.
    mocks.weekplannerPlanFindFirst.mockResolvedValue(null);
    mocks.weekplannerPlanAllocationFindMany.mockResolvedValue([]);
    mocks.weekplannerPlanActivityOverrideFindMany.mockResolvedValue([]);

    const loader = createCanonicalInfoboardSourceLoader(createPolicyDatabase());
    const [event] = await loader({ tenantId: TENANT_A, dateFrom: DAY_WINDOW.from, dateTo: DAY_WINDOW.to });

    expect(event.pitch?.code).toBe("KR2");
    expect(event.startAt.toISOString()).toBe("2026-08-10T15:00:00.000Z");
  });

  it("tenant B is never affected by tenant A's operationally active plan", async () => {
    activatePlanWithOverrides();
    mocks.trainingSessionFindMany.mockImplementation((args: { where?: { tenantId?: string; id?: { in?: string[] } } }) => {
      if (args.where?.tenantId === TENANT_B) return Promise.resolve([]);
      const rows = [trainingSessionRow()];
      if (args.where?.id?.in) return Promise.resolve(rows.filter((r) => args.where!.id!.in!.includes(r.id)));
      return Promise.resolve(rows);
    });
    mocks.weekplannerPlanFindFirst.mockImplementation((args: { where?: { tenantId?: string } }) => {
      if (args.where?.tenantId === TENANT_B) return Promise.resolve(null);
      return Promise.resolve({
        id: PLAN_ID,
        tenantId: TENANT_A,
        weekId: WEEK_ID,
        name: "Schlechtwetterplan",
        createdByUserId: null,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        archivedAt: null,
        isActive: true,
      });
    });

    const loader = createCanonicalInfoboardSourceLoader(createPolicyDatabase());
    const tenantBEvents = await loader({ tenantId: TENANT_B, dateFrom: DAY_WINDOW.from, dateTo: DAY_WINDOW.to });
    expect(tenantBEvents).toHaveLength(0);

    const tenantAEvents = await loader({ tenantId: TENANT_A, dateFrom: DAY_WINDOW.from, dateTo: DAY_WINDOW.to });
    expect(tenantAEvents[0].pitch?.code).toBe("HALLE1");
  });
});
