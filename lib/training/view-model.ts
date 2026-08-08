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

/**
 * Builds the TrainingCenter view model from an already date-scoped session
 * list: per-row operational assessment, KPI counts, and action-filter
 * application.
 *
 * `allocationSummaries` maps trainingSeriesId -> that series' allocation
 * coverage (see lib/training/operational-state.ts) — allocation is
 * series-level, so every occurrence of the same series shares one summary.
 *
 * KPI counts always reflect the FULL window population (never the active
 * action filter) so switching Alle/Offen/Erledigt never changes the
 * summary numbers shown above the list.
 */
export function buildTrainingCenterViewModel(
  sessions: readonly TrainingSessionDto[],
  allocationSummaries: ReadonlyMap<string, TrainingAllocationSummary>,
  options: { actionFilter?: TrainingActionFilter } = {},
): TrainingCenterViewModel {
  const actionFilter = options.actionFilter ?? "ALLE";

  const rows: TrainingSessionRowViewModel[] = [...sessions]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .map((session) => ({
      session,
      assessment: assessTrainingOperationalState(
        session,
        allocationSummaries.get(session.trainingSeriesId),
      ),
    }));

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
