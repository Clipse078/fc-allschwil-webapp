/**
 * lib/matchcenter/view-model.ts
 *
 * MATCHCENTER-UX-01 — Spielplanung/Resultate partitioning, action filtering,
 * and KPI derivation for the Matchcenter overview.
 *
 * Pure, synchronous aggregation over an already month-scoped match list
 * (see lib/matchcenter/month-range.ts + query-service.ts). No I/O, no React.
 */

import type { MatchcenterMatchSummary } from "./types";
import { isMatchCompleted } from "./match-lifecycle";
import {
  assessMatchOperationalState,
  type MatchcenterOperationalAssessment,
} from "./operational-state";

export type MatchcenterActionFilter = "ALLE" | "OFFEN" | "ERLEDIGT";
export type MatchcenterTab = "SPIELPLANUNG" | "RESULTATE";

export type MatchcenterRowViewModel = {
  match: MatchcenterMatchSummary;
  assessment: MatchcenterOperationalAssessment;
};

export type MatchcenterKpis = {
  /** Non-completed matches in the selected month (Spielplanung population). */
  anstehend: number;
  /** Of those, matches with a genuine outstanding operational requirement. */
  offen: number;
  /** Of those, matches with no outstanding operational requirement. */
  bereit: number;
  /** Definitively completed matches in the selected month (Resultate population). */
  resultate: number;
};

export type MatchcenterViewModel = {
  kpis: MatchcenterKpis;
  /** Spielplanung rows, filtered by actionFilter, ascending by kickoff. */
  spielplanung: MatchcenterRowViewModel[];
  /** Resultate rows, descending by kickoff (most recent result first). */
  resultate: MatchcenterMatchSummary[];
};

function isValidActionFilter(
  value: string,
): value is MatchcenterActionFilter {
  return value === "ALLE" || value === "OFFEN" || value === "ERLEDIGT";
}

export function normalizeMatchcenterActionFilter(
  value: string | null | undefined,
): MatchcenterActionFilter {
  const upper = value?.trim().toUpperCase() ?? "";
  return isValidActionFilter(upper) ? upper : "ALLE";
}

export function normalizeMatchcenterTab(
  value: string | null | undefined,
): MatchcenterTab {
  return value?.trim().toUpperCase() === "RESULTATE"
    ? "RESULTATE"
    : "SPIELPLANUNG";
}

/**
 * Builds the full Matchcenter view model from an already month-scoped match
 * list: Spielplanung/Resultate partitioning, action-filter application, and
 * KPI counts.
 *
 * KPI counts always reflect the FULL selected-month population (never the
 * active action filter) so switching Alle/Offen/Erledigt never changes the
 * summary numbers shown above the list.
 */
export function buildMatchcenterViewModel(
  matches: readonly MatchcenterMatchSummary[],
  options: { actionFilter?: MatchcenterActionFilter } = {},
): MatchcenterViewModel {
  const actionFilter = options.actionFilter ?? "ALLE";

  const upcoming: MatchcenterRowViewModel[] = [];
  const completed: MatchcenterMatchSummary[] = [];

  for (const match of matches) {
    if (isMatchCompleted(match)) {
      completed.push(match);
      continue;
    }
    upcoming.push({ match, assessment: assessMatchOperationalState(match) });
  }

  const offenCount = upcoming.filter(
    (row) => row.assessment.status === "OPEN",
  ).length;

  const kpis: MatchcenterKpis = {
    anstehend: upcoming.length,
    offen: offenCount,
    bereit: upcoming.length - offenCount,
    resultate: completed.length,
  };

  const filtered = upcoming.filter((row) => {
    if (actionFilter === "OFFEN") return row.assessment.status === "OPEN";
    if (actionFilter === "ERLEDIGT") return row.assessment.status !== "OPEN";
    return true;
  });

  const spielplanung = [...filtered].sort(
    (a, b) => a.match.startAt.getTime() - b.match.startAt.getTime(),
  );

  const resultate = [...completed].sort(
    (a, b) => b.startAt.getTime() - a.startAt.getTime(),
  );

  return { kpis, spielplanung, resultate };
}
