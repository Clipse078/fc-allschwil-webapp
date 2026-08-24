/**
 * INFOBOARD-TEAMNAME-03A — regression tests for the REAL Screen 1 Training
 * display-name pipeline.
 *
 * Exercises createCanonicalInfoboardSourceLoader → buildInfoboardScreen1Feed
 * → mapScreen1Event (via feed builder) so a missing Prisma select on
 * Team.infoboardDisplayName would fail here, not only in isolated resolver tests.
 *
 * The synthetic /infoboard/screen-1/preview/teamname route uses a static
 * fixture (PREVIEW_FIXTURE_TEAMNAME_ACCEPTANCE) and bypasses this pipeline —
 * which is why manual acceptance on the real /infoboard/screen-1 route exposed
 * the defect while the preview route passed.
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
import {
  CANONICAL_TRAINING_SESSION_POLICY_SELECT,
  type CanonicalInfoboardPolicyDatabase,
  type CanonicalTrainingSessionPolicyRow,
} from "../canonical-source-loader";
import { buildInfoboardScreen1Feed } from "../screen1-feed-builder";
import type { WeekplannerDay, WeekplannerTrainingItem } from "@/lib/weekplanner/types";

const TENANT_ID = "tenant-fca";
const TZ_ZURICH = "Europe/Zurich";

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:session-e1",
    tenantId: TENANT_ID,
    type: "TRAINING",
    startAt: new Date("2026-08-24T15:00:00.000Z"),
    endAt: new Date("2026-08-24T16:00:00.000Z"),
    canonicalStartAt: new Date("2026-08-24T15:00:00.000Z"),
    canonicalEndAt: new Date("2026-08-24T16:00:00.000Z"),
    timeOverridden: false,
    title: "Training",
    teamNames: ["E1"],
    pitchAllocations: [],
    dressingRoomAllocations: [],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-e1",
    trainingSessionId: "session-e1",
    ...overrides,
  };
}

function trainingPolicyRow(
  overrides: Partial<CanonicalTrainingSessionPolicyRow> = {},
): CanonicalTrainingSessionPolicyRow {
  return {
    id: "session-e1",
    status: "SCHEDULED",
    teamSeason: {
      season: { key: "2026-2027" },
      team: {
        name: "FC Allschwil Junioren E1",
        shortName: "Junioren E1",
        alternativeName: "E1",
        infoboardDisplayName: "JUNIOREN E1 TEST",
        infoboardTrainingDisplayName: null,
        infoboardMatchDisplayName: null,
        infoboardTournamentDisplayName: null,
      },
    },
    ...overrides,
  };
}

function makeDay(items: WeekplannerDay["items"], dayKey = "2026-08-24"): WeekplannerDay {
  return { dayKey, items };
}

function makeDatabase(
  trainingRows: CanonicalTrainingSessionPolicyRow[] = [trainingPolicyRow()],
): CanonicalInfoboardPolicyDatabase & {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
} {
  return {
    event: { findMany: vi.fn().mockResolvedValue([]) },
    trainingSession: { findMany: vi.fn().mockResolvedValue(trainingRows) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOperationalWeekplannerPlan.mockResolvedValue(null);
  mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
});

describe("INFOBOARD-TEAMNAME-03A — real Screen 1 Training display-name pipeline", () => {
  it("select clause requests card-specific Team display names for training policy lookup", () => {
    expect(CANONICAL_TRAINING_SESSION_POLICY_SELECT.teamSeason.select.team.select).toMatchObject({
      infoboardDisplayName: true,
      infoboardTrainingDisplayName: true,
      infoboardMatchDisplayName: true,
      infoboardTournamentDisplayName: true,
    });
  });

  it("11 — real Training Screen 1 pipeline prefers infoboardTrainingDisplayName", async () => {
    const database = makeDatabase([
      trainingPolicyRow({
        teamSeason: {
          season: { key: "2026-2027" },
          team: {
            name: "FC Allschwil Junioren E1",
            shortName: "Junioren E1",
            alternativeName: "E1",
            infoboardDisplayName: "JUNIOREN E1 TEST",
            infoboardTrainingDisplayName: "Junioren E1 Training",
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);
    const now = new Date("2026-08-24T14:00:00.000Z");

    const feed = await buildInfoboardScreen1Feed(loader, {
      tenant: {
        id: TENANT_ID,
        key: "fc-allschwil",
        name: "FC Allschwil",
        timezone: TZ_ZURICH,
      },
      timeZone: TZ_ZURICH,
      now,
      dateFrom: new Date("2026-08-24T00:00:00.000Z"),
      dateTo: new Date("2026-08-24T00:00:00.000Z"),
    });

    const trainingCard = [...feed.current, ...feed.next, ...feed.later].find(
      (event) => event.type === "TRAINING",
    );

    expect(trainingCard?.teamDisplayName).toBe("Junioren E1 Training");
    expect(trainingCard?.teamDisplayName).not.toBe("JUNIOREN E1 TEST");
  });

  it("maps persisted infoboardTrainingDisplayName through the canonical loader", async () => {
    const database = makeDatabase([
      trainingPolicyRow({
        teamSeason: {
          season: { key: "2026-2027" },
          team: {
            name: "FC Allschwil Junioren E1",
            shortName: "Junioren E1",
            alternativeName: "E1",
            infoboardDisplayName: "JUNIOREN E1 TEST",
            infoboardTrainingDisplayName: "Junioren E1 Training",
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);

    const [sourceEvent] = await loader({
      tenantId: TENANT_ID,
      dateFrom: new Date("2026-08-24T00:00:00.000Z"),
      dateTo: new Date("2026-08-24T00:00:00.000Z"),
    });

    expect(sourceEvent.team?.infoboardTrainingDisplayName).toBe("Junioren E1 Training");
    expect(sourceEvent.team?.infoboardDisplayName).toBe("JUNIOREN E1 TEST");
    expect(sourceEvent.team?.alternativeName).toBe("E1");
  });

  it("reproduces manual acceptance failure: Training card shows JUNIOREN E1 TEST, not E1", async () => {
    const database = makeDatabase();
    const loader = createCanonicalInfoboardSourceLoader(database);

    // now = 14:00 UTC → 16:00 Europe/Zurich; training at 17:00 local lands in "next"
    const now = new Date("2026-08-24T14:00:00.000Z");

    const feed = await buildInfoboardScreen1Feed(loader, {
      tenant: {
        id: TENANT_ID,
        key: "fc-allschwil",
        name: "FC Allschwil",
        timezone: TZ_ZURICH,
      },
      timeZone: TZ_ZURICH,
      now,
      dateFrom: new Date("2026-08-24T00:00:00.000Z"),
      dateTo: new Date("2026-08-24T00:00:00.000Z"),
    });

    const trainingCard = [...feed.current, ...feed.next, ...feed.later].find(
      (event) => event.type === "TRAINING",
    );

    expect(trainingCard?.teamDisplayName).toBe("JUNIOREN E1 TEST");
    expect(trainingCard?.teamDisplayName).not.toBe("E1");
  });

  it("falls back alternativeName → shortName → team name when infoboardDisplayName is empty", async () => {
    mocks.getWeekplannerDay.mockResolvedValue(makeDay([trainingItem()]));
    const database = makeDatabase([
      trainingPolicyRow({
        teamSeason: {
          season: { key: "2026-2027" },
          team: {
            name: "FC Allschwil Junioren E1",
            shortName: "Junioren E1",
            alternativeName: "E1",
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      }),
    ]);
    const loader = createCanonicalInfoboardSourceLoader(database);
    const now = new Date("2026-08-24T14:00:00.000Z");

    const feed = await buildInfoboardScreen1Feed(loader, {
      tenant: {
        id: TENANT_ID,
        key: "fc-allschwil",
        name: "FC Allschwil",
        timezone: TZ_ZURICH,
      },
      timeZone: TZ_ZURICH,
      now,
      dateFrom: new Date("2026-08-24T00:00:00.000Z"),
      dateTo: new Date("2026-08-24T00:00:00.000Z"),
    });

    const trainingCard = [...feed.current, ...feed.next, ...feed.later].find(
      (event) => event.type === "TRAINING",
    );
    expect(trainingCard?.teamDisplayName).toBe("E1");
  });

  it("scopes training policy lookup by tenantId", async () => {
    const database = makeDatabase();
    const loader = createCanonicalInfoboardSourceLoader(database);

    await loader({
      tenantId: TENANT_ID,
      dateFrom: new Date("2026-08-24T00:00:00.000Z"),
      dateTo: new Date("2026-08-24T00:00:00.000Z"),
    });

    const call = database.trainingSession.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe(TENANT_ID);
  });
});
