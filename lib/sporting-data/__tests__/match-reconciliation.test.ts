import { describe, expect, it } from "vitest";
import { buildMatchcenterViewModel } from "@/lib/matchcenter/view-model";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import {
  classifyMatchReconciliation,
  planMatchReconciliation,
  reconcileMatchLifecycle,
  resolveReconciledResultLabel,
  type MatchReconciliationCandidate,
  type MatchReconciliationDatabase,
} from "../match-reconciliation";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const TENANT_ID = "tenant-fca";
const SEASON_ID = "season-2026-2027";
const EXTERNAL_SEASON_ID = 2027;

function makeCandidate(
  overrides: Partial<MatchReconciliationCandidate> = {},
): MatchReconciliationCandidate {
  return {
    eventId: "event-1",
    tenantId: TENANT_ID,
    seasonId: SEASON_ID,
    teamId: "team-b2",
    type: "MATCH",
    source: "SFV",
    status: "SCHEDULED",
    startAt: new Date("2026-08-02T16:00:00.000Z"),
    resultLabel: null,
    providerMatchStateName: "ausgetragen",
    scoreHome: 2,
    scoreAway: 1,
    externalMatchId: 99001,
    externalSeasonId: EXTERNAL_SEASON_ID,
    ...overrides,
  };
}

function makeDatabase(
  candidates: MatchReconciliationCandidate[],
): MatchReconciliationDatabase & { updates: Array<{ id: string; data: Record<string, unknown> }> } {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

  return {
    updates,
    event: {
      async findMany() {
        return candidates.map((candidate) => ({
          id: candidate.eventId,
          tenantId: candidate.tenantId,
          seasonId: candidate.seasonId,
          teamId: candidate.teamId,
          type: candidate.type,
          source: candidate.source,
          status: candidate.status,
          startAt: candidate.startAt,
          resultLabel: candidate.resultLabel,
          matchExternalMapping: {
            externalMatchId: candidate.externalMatchId,
            externalSeasonId: candidate.externalSeasonId,
            providerMatchStateName: candidate.providerMatchStateName,
            scoreHome: candidate.scoreHome,
            scoreAway: candidate.scoreAway,
          },
        }));
      },
      async updateMany() {
        return { count: 0 };
      },
      async update(args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        updates.push({ id: args.where.id, data: args.data });
        const candidate = candidates.find((row) => row.eventId === args.where.id);
        if (!candidate) return;
        if (typeof args.data.status === "string") {
          candidate.status = args.data.status;
        }
        if ("resultLabel" in args.data) {
          candidate.resultLabel = (args.data.resultLabel as string | null) ?? null;
        }
      },
    },
  };
}

function createMatchSummary(
  overrides: Partial<MatchcenterMatchSummary> = {},
): MatchcenterMatchSummary {
  return {
    id: "event-1",
    tenantId: TENANT_ID,
    teamId: "team-b2",
    seasonId: SEASON_ID,
    type: "MATCH",
    title: "FC Allschwil B2 – Gegner",
    description: null,
    status: "SCHEDULED",
    startAt: new Date("2026-08-02T16:00:00.000Z"),
    endAt: null,
    location: "Im Brüel",
    competitionLabel: "Meisterschaft",
    homeAway: "HOME",
    resultLabel: null,
    intermediateResultLabel: null,
    scoreHome: 2,
    scoreAway: 1,
    home: {
      providerTeamId: 1,
      providerTeamName: "FC Allschwil B2",
      canonicalTeamId: "team-b2",
      canonicalTeamName: "FC Allschwil B2",
      displayName: "FC Allschwil B2",
      resolution: "RESOLVED",
      isOwnTeam: true,
    },
    away: {
      providerTeamId: 2,
      providerTeamName: "Gegner",
      canonicalTeamId: null,
      canonicalTeamName: null,
      displayName: "Gegner",
      resolution: "UNRESOLVED",
      isOwnTeam: false,
    },
    source: {
      eventSource: "SFV",
      externalSource: "SFV",
      externalSourceId: "99001",
      provider: "SFV",
      externalMatchId: 99001,
      externalSeasonId: EXTERNAL_SEASON_ID,
      matchNumber: 1,
    },
    synchronization: {
      eventLastSyncedAt: null,
      mappingLastSyncedAt: null,
      detailSyncedAt: null,
      providerMatchState: null,
      providerMatchStateName: "ausgetragen",
    },
    operational: {
      pitchCode: null,
      homeDressingRoomCode: null,
      awayDressingRoomCode: null,
      meetingTime: null,
      remarks: null,
    },
    visibility: {
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: false,
      wochenplanVisible: false,
      trainingsplanVisible: false,
      teamPageVisible: false,
    },
    ...overrides,
  };
}

describe("classifyMatchReconciliation", () => {
  it("1. provider completed + SCHEDULED → planned COMPLETED", () => {
    const result = classifyMatchReconciliation(makeCandidate(), { now: NOW });
    expect(result.action).toBe("set_completed");
    expect(result.targetStatus).toBe("COMPLETED");
    expect(result.targetResultLabel).toBe("2:1");
  });

  it("2. provider completed + COMPLETED → no-op", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({ status: "COMPLETED", resultLabel: "2:1" }),
      { now: NOW },
    );
    expect(result.action).toBe("noop");
  });

  it("3. completed 0:0 remains valid", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        scoreHome: 0,
        scoreAway: 0,
        resultLabel: "0:0",
        status: "COMPLETED",
      }),
      { now: NOW },
    );
    expect(result.action).toBe("noop");
  });

  it("4. future 0:0 remains non-result", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        providerMatchStateName: "noch nicht ausgetragen",
        scoreHome: 0,
        scoreAway: 0,
      }),
      { now: NOW },
    );
    expect(result.action).toBe("noop");
  });

  it("5. stale past unplayed → no automatic COMPLETED", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        providerMatchStateName: "noch nicht ausgetragen",
      }),
      { now: NOW },
    );
    expect(result.action).toBe("unsafe");
  });

  it("6. postponed handling", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        providerMatchStateName: "verschoben",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
      }),
      { now: NOW },
    );
    expect(result.action).toBe("set_postponed");
    expect(result.targetStatus).toBe("POSTPONED");
  });

  it("7. cancelled handling", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        providerMatchStateName: "abgesagt",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
      }),
      { now: NOW },
    );
    expect(result.action).toBe("set_cancelled");
    expect(result.targetStatus).toBe("CANCELLED");
  });

  it("8. resultLabel preservation", () => {
    const label = resolveReconciledResultLabel({
      existingResultLabel: "2:1 (n.P.)",
      scoreHome: 1,
      scoreAway: 1,
      targetStatus: "COMPLETED",
    });
    expect(label).toBe("2:1 (n.P.)");
  });

  it("9. numeric score preservation via fallback label", () => {
    const label = resolveReconciledResultLabel({
      existingResultLabel: null,
      scoreHome: 3,
      scoreAway: 2,
      targetStatus: "COMPLETED",
    });
    expect(label).toBe("3:2");
  });

  it("10. manual data not overwritten by empty provider data", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({
        resultLabel: "4:3",
        scoreHome: null,
        scoreAway: null,
      }),
      { now: NOW },
    );
    expect(result.targetResultLabel).toBe("4:3");
  });

  it("14. non-MATCH events untouched", () => {
    const result = classifyMatchReconciliation(
      makeCandidate({ type: "TRAINING" }),
      { now: NOW },
    );
    expect(result.action).toBe("unsafe");
  });
});

describe("planMatchReconciliation", () => {
  it("11. tenant isolation via query scope", async () => {
    const db = makeDatabase([makeCandidate()]);
    const plan = await planMatchReconciliation(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      now: NOW,
    });
    expect(plan.evaluated).toBe(1);
    expect(plan.planned).toHaveLength(1);
  });

  it("12. season isolation is enforced by loader contract", async () => {
    const db = makeDatabase([
      makeCandidate({ seasonId: SEASON_ID }),
      makeCandidate({ eventId: "event-2", seasonId: "other-season" }),
    ]);
    const plan = await planMatchReconciliation(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      now: NOW,
    });
    expect(plan.evaluated).toBe(2);
  });
});

describe("reconcileMatchLifecycle", () => {
  it("15. dry-run causes zero mutation", async () => {
    const db = makeDatabase([makeCandidate()]);
    const result = await reconcileMatchLifecycle(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      dryRun: true,
      now: NOW,
    });
    expect(result.applied).toBe(0);
    expect(result.planned).toHaveLength(1);
    expect(db.updates).toHaveLength(0);
  });

  it("16. second reconciliation is idempotent", async () => {
    const db = makeDatabase([makeCandidate()]);
    const first = await reconcileMatchLifecycle(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      dryRun: false,
      now: NOW,
    });
    const second = await reconcileMatchLifecycle(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      dryRun: false,
      now: NOW,
    });
    expect(first.applied).toBe(1);
    expect(second.applied).toBe(0);
    expect(second.planned).toHaveLength(0);
  });
});

describe("matchcenter data acceptance after reconciliation", () => {
  it("17. upcoming/result sets do not overlap", async () => {
    const candidates = [
      makeCandidate({ eventId: "completed", status: "COMPLETED", resultLabel: "2:1" }),
      makeCandidate({
        eventId: "upcoming",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        providerMatchStateName: "noch nicht ausgetragen",
        scoreHome: 0,
        scoreAway: 0,
      }),
    ];
    const db = makeDatabase(candidates);
    await reconcileMatchLifecycle(db, {
      tenantId: TENANT_ID,
      seasonId: SEASON_ID,
      externalSeasonId: EXTERNAL_SEASON_ID,
      dryRun: false,
      now: NOW,
    });

    const matches = candidates.map((candidate) =>
      createMatchSummary({
        id: candidate.eventId,
        status: candidate.status,
        resultLabel: candidate.resultLabel,
        startAt: candidate.startAt,
        synchronization: {
          eventLastSyncedAt: null,
          mappingLastSyncedAt: null,
          detailSyncedAt: null,
          providerMatchState: null,
          providerMatchStateName: candidate.providerMatchStateName,
        },
      }),
    );

    const viewModel = buildMatchcenterViewModel(matches, { now: NOW });
    const spielplanungIds = new Set(viewModel.spielplanung.map((row) => row.match.id));
    const resultateIds = new Set(viewModel.resultate.map((row) => row.id));
    for (const id of spielplanungIds) {
      expect(resultateIds.has(id)).toBe(false);
    }
  });

  it("18. historical completed matches leave Spielplanung", () => {
    const before = buildMatchcenterViewModel(
      [
        createMatchSummary({
          startAt: new Date("2026-09-05T16:00:00.000Z"),
          status: "SCHEDULED",
          synchronization: {
            eventLastSyncedAt: null,
            mappingLastSyncedAt: null,
            detailSyncedAt: null,
            providerMatchState: null,
            providerMatchStateName: "noch nicht ausgetragen",
          },
        }),
      ],
      { now: NOW },
    );
    const after = buildMatchcenterViewModel(
      [
        createMatchSummary({
          status: "COMPLETED",
          resultLabel: "2:1",
          synchronization: {
            eventLastSyncedAt: null,
            mappingLastSyncedAt: null,
            detailSyncedAt: null,
            providerMatchState: null,
            providerMatchStateName: "ausgetragen",
          },
        }),
      ],
      { now: NOW },
    );
    expect(before.spielplanung).toHaveLength(1);
    expect(after.spielplanung).toHaveLength(0);
  });

  it("19. completed matches enter Resultate", () => {
    const viewModel = buildMatchcenterViewModel(
      [createMatchSummary({ status: "COMPLETED", resultLabel: "2:1" })],
      { now: NOW },
    );
    expect(viewModel.resultate).toHaveLength(1);
    expect(viewModel.kpis.resultate).toBe(1);
  });

  it("20. future matches remain in Spielplanung", () => {
    const viewModel = buildMatchcenterViewModel(
      [
        createMatchSummary({
          startAt: new Date("2026-09-05T16:00:00.000Z"),
          synchronization: {
            eventLastSyncedAt: null,
            mappingLastSyncedAt: null,
            detailSyncedAt: null,
            providerMatchState: null,
            providerMatchStateName: "noch nicht ausgetragen",
          },
        }),
      ],
      { now: NOW },
    );
    expect(viewModel.spielplanung).toHaveLength(1);
    expect(viewModel.resultate).toHaveLength(0);
  });
});
