/**
 * lib/sporting-data/match-reconciliation.ts
 *
 * TEAM-SFV-03 — canonical SFV match lifecycle/result reconciliation.
 *
 * Aligns persisted Event.status (and resultLabel when needed) with the
 * TEAM-SFV-02B sporting lifecycle rules. Detection reuses
 * classifySportingMatchLifecycle — no parallel lifecycle rules.
 */

import type { PrismaClient } from "@prisma/client";
import {
  buildResultLabel,
  resolvePersistedEventStatus,
} from "@/lib/integrations/sfv/sync/schedule-mapper";
import {
  classifySportingMatchLifecycle,
  type SportingReconciliationIssue,
} from "./lifecycle";
import { classifyProviderMatchDisposition } from "./provider-state";

export const MATCH_LIFECYCLE_RECONCILIATION_PROVIDER = "SFV";

export type EventStatusValue =
  | "SCHEDULED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED";

export type MatchReconciliationCandidate = {
  eventId: string;
  tenantId: string;
  seasonId: string | null;
  teamId: string | null;
  type: string;
  source: string;
  status: string;
  startAt: Date;
  resultLabel: string | null;
  providerMatchStateName: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  externalMatchId: number;
  externalSeasonId: number;
};

export type MatchReconciliationActionKind =
  | "noop"
  | "set_completed"
  | "set_postponed"
  | "set_cancelled"
  | "set_live"
  | "unsafe";

export type MatchReconciliationClassification = {
  action: MatchReconciliationActionKind;
  reason: string;
  reconciliationIssue: SportingReconciliationIssue | null;
  targetStatus: EventStatusValue | null;
  targetResultLabel: string | null | undefined;
};

export type MatchReconciliationPlannedMutation = {
  eventId: string;
  externalMatchId: number;
  currentStatus: string;
  targetStatus: EventStatusValue;
  currentResultLabel: string | null;
  targetResultLabel: string | null;
  reason: string;
};

export type MatchReconciliationLifecycleCounts = {
  UPCOMING: number;
  LIVE: number;
  COMPLETED: number;
  POSTPONED: number;
  CANCELLED: number;
  NEEDS_RECONCILIATION: number;
};

export type MatchReconciliationPlan = {
  tenantId: string;
  seasonId: string;
  externalSeasonId: number;
  evaluated: number;
  planned: MatchReconciliationPlannedMutation[];
  unsafe: Array<{ eventId: string; externalMatchId: number; reason: string }>;
  beforeCounts: MatchReconciliationLifecycleCounts;
  afterCounts: MatchReconciliationLifecycleCounts;
};

export type MatchReconciliationResult = MatchReconciliationPlan & {
  dryRun: boolean;
  applied: number;
  completedUpdates: number;
  postponedUpdates: number;
  cancelledUpdates: number;
  liveUpdates: number;
};

export type MatchReconciliationDatabase = {
  event: {
    findMany(args: object): Promise<
      Array<{
        id: string;
        tenantId: string | null;
        seasonId: string | null;
        teamId: string | null;
        type: string;
        source: string;
        status: string;
        startAt: Date;
        resultLabel: string | null;
        matchExternalMapping: {
          externalMatchId: number;
          externalSeasonId: number;
          providerMatchStateName: string | null;
          scoreHome: number | null;
          scoreAway: number | null;
        } | null;
      }>
    >;
    updateMany(args: object): Promise<{ count: number }>;
    update(args: object): Promise<unknown>;
  };
};

function emptyLifecycleCounts(): MatchReconciliationLifecycleCounts {
  return {
    UPCOMING: 0,
    LIVE: 0,
    COMPLETED: 0,
    POSTPONED: 0,
    CANCELLED: 0,
    NEEDS_RECONCILIATION: 0,
  };
}

function normalizedStatus(status: string): EventStatusValue | string {
  return status.trim().toUpperCase();
}

function isMatchCandidate(candidate: MatchReconciliationCandidate): boolean {
  return (
    candidate.type === "MATCH" &&
    candidate.source === MATCH_LIFECYCLE_RECONCILIATION_PROVIDER
  );
}

/**
 * Resolves the result label to persist when promoting a match to a terminal
 * result-bearing status. Preserves existing manual labels; never invents
 * scores from empty provider data.
 */
export function resolveReconciledResultLabel(input: {
  existingResultLabel: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  targetStatus: EventStatusValue;
}): string | null {
  const explicit = input.existingResultLabel?.trim();
  if (explicit) {
    return explicit;
  }

  return buildResultLabel(
    input.scoreHome,
    input.scoreAway,
    input.targetStatus,
  );
}

/**
 * Pure per-row reconciliation classifier. Uses TEAM-SFV-02B lifecycle rules.
 */
export function classifyMatchReconciliation(
  candidate: MatchReconciliationCandidate,
  options: { now?: Date } = {},
): MatchReconciliationClassification {
  if (!isMatchCandidate(candidate)) {
    return {
      action: "unsafe",
      reason: "Not an SFV MATCH event — excluded from reconciliation.",
      reconciliationIssue: null,
      targetStatus: null,
      targetResultLabel: undefined,
    };
  }

  const now = options.now ?? new Date();
  const providerDisposition = classifyProviderMatchDisposition(
    candidate.providerMatchStateName,
  );
  const classification = classifySportingMatchLifecycle({
    status: candidate.status,
    startAt: candidate.startAt,
    providerMatchStateName: candidate.providerMatchStateName,
    now,
  });
  const currentStatus = normalizedStatus(candidate.status);

  if (classification.lifecycle === "NEEDS_RECONCILIATION") {
    return {
      action: "unsafe",
      reason:
        "Past fixture with provider-not-played semantics — never auto-completed.",
      reconciliationIssue: classification.reconciliationIssue,
      targetStatus: null,
      targetResultLabel: undefined,
    };
  }

  if (providerDisposition === "UNKNOWN" && currentStatus === "SCHEDULED") {
    const past = candidate.startAt.getTime() < now.getTime();
    if (past) {
      return {
        action: "unsafe",
        reason: "Ambiguous past fixture with unknown provider disposition.",
        reconciliationIssue: classification.reconciliationIssue,
        targetStatus: null,
        targetResultLabel: undefined,
      };
    }
  }

  if (providerDisposition === "COMPLETED" && currentStatus !== "COMPLETED") {
    const targetStatus: EventStatusValue = "COMPLETED";
    return {
      action: "set_completed",
      reason: "Provider completed; persisted Event.status is not COMPLETED.",
      reconciliationIssue: classification.reconciliationIssue,
      targetStatus,
      targetResultLabel: resolveReconciledResultLabel({
        existingResultLabel: candidate.resultLabel,
        scoreHome: candidate.scoreHome,
        scoreAway: candidate.scoreAway,
        targetStatus,
      }),
    };
  }

  if (providerDisposition === "POSTPONED" && currentStatus !== "POSTPONED") {
    return {
      action: "set_postponed",
      reason: "Provider postponed; persisted Event.status is not POSTPONED.",
      reconciliationIssue: classification.reconciliationIssue,
      targetStatus: "POSTPONED",
      targetResultLabel: candidate.resultLabel,
    };
  }

  if (providerDisposition === "CANCELLED" && currentStatus !== "CANCELLED") {
    return {
      action: "set_cancelled",
      reason: "Provider cancelled; persisted Event.status is not CANCELLED.",
      reconciliationIssue: classification.reconciliationIssue,
      targetStatus: "CANCELLED",
      targetResultLabel: candidate.resultLabel,
    };
  }

  if (providerDisposition === "LIVE" && currentStatus !== "LIVE") {
    return {
      action: "set_live",
      reason: "Provider live; persisted Event.status is not LIVE.",
      reconciliationIssue: classification.reconciliationIssue,
      targetStatus: "LIVE",
      targetResultLabel: resolveReconciledResultLabel({
        existingResultLabel: candidate.resultLabel,
        scoreHome: candidate.scoreHome,
        scoreAway: candidate.scoreAway,
        targetStatus: "LIVE",
      }),
    };
  }

  return {
    action: "noop",
    reason: "Persisted status already matches provider lifecycle.",
    reconciliationIssue: classification.reconciliationIssue,
    targetStatus: null,
    targetResultLabel: undefined,
  };
}

function lifecycleCountsFromCandidates(
  candidates: readonly MatchReconciliationCandidate[],
  options: {
    now?: Date;
    statusOverride?: Map<string, EventStatusValue>;
  } = {},
): MatchReconciliationLifecycleCounts {
  const counts = emptyLifecycleCounts();
  const now = options.now ?? new Date();

  for (const candidate of candidates) {
    const status =
      options.statusOverride?.get(candidate.eventId) ?? candidate.status;
    const { lifecycle } = classifySportingMatchLifecycle({
      status,
      startAt: candidate.startAt,
      providerMatchStateName: candidate.providerMatchStateName,
      now,
    });
    counts[lifecycle]++;
  }

  return counts;
}

function toPlannedMutation(
  candidate: MatchReconciliationCandidate,
  classification: MatchReconciliationClassification,
): MatchReconciliationPlannedMutation | null {
  if (
    classification.action === "noop" ||
    classification.action === "unsafe" ||
    classification.targetStatus == null
  ) {
    return null;
  }

  const targetResultLabel =
    classification.targetResultLabel === undefined
      ? candidate.resultLabel
      : classification.targetResultLabel;

  return {
    eventId: candidate.eventId,
    externalMatchId: candidate.externalMatchId,
    currentStatus: candidate.status,
    targetStatus: classification.targetStatus,
    currentResultLabel: candidate.resultLabel,
    targetResultLabel,
    reason: classification.reason,
  };
}

/**
 * Read-only reconciliation plan for a tenant + season scope.
 */
export async function planMatchReconciliation(
  database: MatchReconciliationDatabase,
  input: {
    tenantId: string;
    seasonId: string;
    externalSeasonId: number;
    now?: Date;
  },
): Promise<MatchReconciliationPlan> {
  const candidates = await loadReconciliationCandidates(database, input);
  const now = input.now ?? new Date();
  const planned: MatchReconciliationPlannedMutation[] = [];
  const unsafe: MatchReconciliationPlan["unsafe"] = [];
  const afterStatusOverride = new Map<string, EventStatusValue>();

  for (const candidate of candidates) {
    const classification = classifyMatchReconciliation(candidate, { now });
    const mutation = toPlannedMutation(candidate, classification);

    if (classification.action === "unsafe") {
      unsafe.push({
        eventId: candidate.eventId,
        externalMatchId: candidate.externalMatchId,
        reason: classification.reason,
      });
      continue;
    }

    if (mutation) {
      planned.push(mutation);
      afterStatusOverride.set(candidate.eventId, mutation.targetStatus);
    }
  }

  return {
    tenantId: input.tenantId,
    seasonId: input.seasonId,
    externalSeasonId: input.externalSeasonId,
    evaluated: candidates.length,
    planned,
    unsafe,
    beforeCounts: lifecycleCountsFromCandidates(candidates, { now }),
    afterCounts: lifecycleCountsFromCandidates(candidates, {
      now,
      statusOverride: afterStatusOverride,
    }),
  };
}

/**
 * Executes (or dry-runs) the canonical reconciliation plan.
 */
export async function reconcileMatchLifecycle(
  database: MatchReconciliationDatabase,
  input: {
    tenantId: string;
    seasonId: string;
    externalSeasonId: number;
    dryRun: boolean;
    now?: Date;
  },
): Promise<MatchReconciliationResult> {
  const plan = await planMatchReconciliation(database, input);

  if (input.dryRun || plan.planned.length === 0) {
    return {
      ...plan,
      dryRun: input.dryRun,
      applied: 0,
      completedUpdates: 0,
      postponedUpdates: 0,
      cancelledUpdates: 0,
      liveUpdates: 0,
    };
  }

  let applied = 0;
  let completedUpdates = 0;
  let postponedUpdates = 0;
  let cancelledUpdates = 0;
  let liveUpdates = 0;

  for (const mutation of plan.planned) {
    const data: {
      status: EventStatusValue;
      resultLabel?: string | null;
    } = {
      status: mutation.targetStatus,
    };

    if (
      mutation.targetResultLabel !== mutation.currentResultLabel &&
      (mutation.targetStatus === "COMPLETED" || mutation.targetStatus === "LIVE")
    ) {
      data.resultLabel = mutation.targetResultLabel;
    }

    await database.event.update({
      where: { id: mutation.eventId },
      data,
    });

    applied++;
    if (mutation.targetStatus === "COMPLETED") completedUpdates++;
    if (mutation.targetStatus === "POSTPONED") postponedUpdates++;
    if (mutation.targetStatus === "CANCELLED") cancelledUpdates++;
    if (mutation.targetStatus === "LIVE") liveUpdates++;
  }

  return {
    ...plan,
    dryRun: false,
    applied,
    completedUpdates,
    postponedUpdates,
    cancelledUpdates,
    liveUpdates,
  };
}

export function createPrismaMatchReconciliationDatabase(
  prisma: PrismaClient,
): MatchReconciliationDatabase {
  return prisma as unknown as MatchReconciliationDatabase;
}

export async function loadReconciliationCandidates(
  database: MatchReconciliationDatabase,
  input: {
    tenantId: string;
    seasonId: string;
    externalSeasonId: number;
  },
): Promise<MatchReconciliationCandidate[]> {
  const rows = await database.event.findMany({
    where: {
      tenantId: input.tenantId,
      seasonId: input.seasonId,
      type: "MATCH",
      source: MATCH_LIFECYCLE_RECONCILIATION_PROVIDER,
      matchExternalMapping: {
        provider: MATCH_LIFECYCLE_RECONCILIATION_PROVIDER,
        externalSeasonId: input.externalSeasonId,
      },
    },
    select: {
      id: true,
      tenantId: true,
      seasonId: true,
      teamId: true,
      type: true,
      source: true,
      status: true,
      startAt: true,
      resultLabel: true,
      matchExternalMapping: {
        select: {
          externalMatchId: true,
          externalSeasonId: true,
          providerMatchStateName: true,
          scoreHome: true,
          scoreAway: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  return rows.map((row) => ({
    eventId: row.id,
    tenantId: row.tenantId ?? input.tenantId,
    seasonId: row.seasonId,
    teamId: row.teamId,
    type: row.type,
    source: row.source,
    status: row.status,
    startAt: row.startAt,
    resultLabel: row.resultLabel,
    providerMatchStateName: row.matchExternalMapping?.providerMatchStateName ?? null,
    scoreHome: row.matchExternalMapping?.scoreHome ?? null,
    scoreAway: row.matchExternalMapping?.scoreAway ?? null,
    externalMatchId: row.matchExternalMapping?.externalMatchId ?? 0,
    externalSeasonId: row.matchExternalMapping?.externalSeasonId ?? input.externalSeasonId,
  }));
}

export { resolvePersistedEventStatus };
