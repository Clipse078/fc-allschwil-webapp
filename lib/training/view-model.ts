/**
 * lib/training/view-model.ts
 *
 * TRAININGCENTER-01 — Alle/Offen/Erledigt action filtering and KPI
 * derivation for the TrainingCenter Monat/Woche/Tag operational views.
 *
 * Pure, synchronous aggregation over an already date-scoped TrainingSession
 * list (see lib/training/date-range.ts + session-generation-service.ts).
 * No I/O, no React. Mirrors lib/matchcenter/view-model.ts so the two
 * sibling modules share one operational-filtering contract.
 */

import type { TrainingSessionDto } from "./types";
import {
  assessTrainingOperationalState,
  type TrainingAllocationSummary,
  type TrainingOperationalAssessment,
} from "./operational-state";

export type TrainingActionFilter = "ALLE" | "OFFEN" | "ERLEDIGT";

export type TrainingSessionRowViewModel = {
  session: TrainingSessionDto;
  assessment: TrainingOperationalAssessment;
  /**
   * TRAININGCENTER-02: the EFFECTIVE allocation summary for this specific
   * occurrence — its own TrainingSessionAllocation overrides (per group,
   * see lib/training/session-allocation-service.ts) OR'd with its series'
   * TrainingAllocation summary. `assessment` above is already derived from
   * this same resolved value, so the two can never disagree; this is
   * exposed separately so presentation code (e.g. TrainingSessionRow's
   * Spielfeld/Halle + Garderobe chips) doesn't need to re-resolve it.
   */
  allocationSummary: TrainingAllocationSummary;
};

export type TrainingCenterKpis = {
  /** All sessions in the currently-viewed window. */
  gesamt: number;
  /** Of those, sessions with a genuine outstanding operational requirement. */
  offen: number;
  /** Of those, sessions with no outstanding operational requirement. */
  erledigt: number;
};

export type TrainingCenterViewModel = {
  kpis: TrainingCenterKpis;
  /** All rows in the window, ascending by start time, annotated with their assessment. */
  rows: TrainingSessionRowViewModel[];
  /** `rows` filtered by the active actionFilter — this is what views should render. */
  filteredRows: TrainingSessionRowViewModel[];
};

function isValidActionFilter(value: string): value is TrainingActionFilter {
  return value === "ALLE" || value === "OFFEN" || value === "ERLEDIGT";
}

export function normalizeTrainingActionFilter(
  value: string | null | undefined,
): TrainingActionFilter {
  const upper = value?.trim().toUpperCase() ?? "";
  return isValidActionFilter(upper) ? upper : "ALLE";
}

/** Combines a per-group series-level summary with a per-group occurrence override: override wins per group, series is the fallback. */
function resolveEffectiveAllocationSummary(
  seriesSummary: TrainingAllocationSummary | undefined,
  sessionOverride: TrainingAllocationSummary | undefined,
): TrainingAllocationSummary {
  return {
    hasPitchAllocation: Boolean(sessionOverride?.hasPitchAllocation || seriesSummary?.hasPitchAllocation),
    hasDressingRoomAllocation: Boolean(
      sessionOverride?.hasDressingRoomAllocation || seriesSummary?.hasDressingRoomAllocation,
    ),
  };
}

/**
 * Builds the TrainingCenter view model from an already date-scoped session
 * list: per-row operational assessment, KPI counts, and action-filter
 * application.
 *
 * `allocationSummaries` maps trainingSeriesId -> that series' allocation
 * coverage (see lib/training/operational-state.ts) — allocation is
 * series-level by default, so every occurrence of the same series shares
 * one summary.
 *
 * `sessionAllocationOverrides` (TRAININGCENTER-02) optionally maps
 * trainingSessionId -> that specific occurrence's override coverage (see
 * lib/training/session-allocation-service.ts). When present for a given
 * allocation group (Spielfeld/Halle or Garderobe), it supersedes the
 * series-level summary for that occurrence only — independently per group.
 *
 * KPI counts always reflect the FULL window population (never the active
 * action filter) so switching Alle/Offen/Erledigt never changes the
 * summary numbers shown above the list.
 */
export function buildTrainingCenterViewModel(
  sessions: readonly TrainingSessionDto[],
  allocationSummaries: ReadonlyMap<string, TrainingAllocationSummary>,
  options: {
    actionFilter?: TrainingActionFilter;
    sessionAllocationOverrides?: ReadonlyMap<string, TrainingAllocationSummary>;
  } = {},
): TrainingCenterViewModel {
  const actionFilter = options.actionFilter ?? "ALLE";
  const sessionAllocationOverrides = options.sessionAllocationOverrides;

  const rows: TrainingSessionRowViewModel[] = [...sessions]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .map((session) => {
      const allocationSummary = resolveEffectiveAllocationSummary(
        allocationSummaries.get(session.trainingSeriesId),
        sessionAllocationOverrides?.get(session.id),
      );
      return {
        session,
        assessment: assessTrainingOperationalState(session, allocationSummary),
        allocationSummary,
      };
    });

  const offenCount = rows.filter((row) => row.assessment.status === "OPEN").length;

  const kpis: TrainingCenterKpis = {
    gesamt: rows.length,
    offen: offenCount,
    erledigt: rows.length - offenCount,
  };

  const filteredRows = rows.filter((row) => {
    if (actionFilter === "OFFEN") return row.assessment.status === "OPEN";
    if (actionFilter === "ERLEDIGT") return row.assessment.status !== "OPEN";
    return true;
  });

  return { kpis, rows, filteredRows };
}
