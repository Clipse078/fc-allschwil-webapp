/**
 * lib/matchcenter/view-model.ts
 *
 * MATCHCENTER-UX-01 — Spielplanung/Resultate partitioning, action filtering,
 * and KPI derivation for the Matchcenter overview.
 *
 * TEAM-SFV-02B: uses canonical sporting lifecycle for upcoming/results split.
 */

import type { MatchcenterMatchSummary } from "./types";
import {
  isSportingMatchInResultsList,
  isSportingMatchInUpcomingList,
  classifySportingMatchLifecycle,
} from "@/lib/sporting-data/lifecycle";
import {
  assessMatchOperationalState,
  type MatchcenterOperationalAssessment,
} from "./operational-state";

export type MatchcenterActionFilter = "ALLE" | "OFFEN" | "ERLEDIGT";
export type MatchcenterTab = "SPIELPLANUNG" | "RESULTATE";
export type MatchcenterWochenplanFilter =
  | "ALLE"
  | "IM_WOCHENPLAN"
  | "NICHT_IM_WOCHENPLAN";

export type MatchcenterRowViewModel = {
  match: MatchcenterMatchSummary;
  assessment: MatchcenterOperationalAssessment;
};

export type MatchcenterKpis = {
  /** Genuinely upcoming matches (UPCOMING + LIVE) in the selected month. */
  anstehend: number;
  /** Of those, matches with a genuine outstanding operational requirement. */
  offen: number;
  /** Of those, matches with no outstanding operational requirement. */
  bereit: number;
  /** Canonically completed matches in the selected month (Resultate population). */
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

function isValidWochenplanFilter(
  value: string,
): value is MatchcenterWochenplanFilter {
  return (
    value === "ALLE" ||
    value === "IM_WOCHENPLAN" ||
    value === "NICHT_IM_WOCHENPLAN"
  );
}

export function normalizeMatchcenterWochenplanFilter(
  value: string | null | undefined,
): MatchcenterWochenplanFilter {
  const upper = value?.trim().toUpperCase() ?? "";
  return isValidWochenplanFilter(upper) ? upper : "ALLE";
}

export function normalizeMatchcenterTab(
  value: string | null | undefined,
): MatchcenterTab {
  return value?.trim().toUpperCase() === "RESULTATE"
    ? "RESULTATE"
    : "SPIELPLANUNG";
}

function resolveLifecycle(
  match: MatchcenterMatchSummary,
  now?: Date,
) {
  return classifySportingMatchLifecycle({
    status: match.status,
    startAt: match.startAt,
    providerMatchStateName: match.synchronization.providerMatchStateName,
    now,
  }).lifecycle;
}

/**
 * Builds the full Matchcenter view model from an already month-scoped match
 * list: Spielplanung/Resultate partitioning, action-filter application, and
 * KPI counts.
 */
export function buildMatchcenterViewModel(
  matches: readonly MatchcenterMatchSummary[],
  options: {
    actionFilter?: MatchcenterActionFilter;
    wochenplanFilter?: MatchcenterWochenplanFilter;
    now?: Date;
  } = {},
): MatchcenterViewModel {
  const actionFilter = options.actionFilter ?? "ALLE";
  const wochenplanFilter = options.wochenplanFilter ?? "ALLE";
  const now = options.now;

  const wochenplanFiltered = matches.filter((match) => {
    if (wochenplanFilter === "IM_WOCHENPLAN") {
      return match.visibility.wochenplanVisible === true;
    }
    if (wochenplanFilter === "NICHT_IM_WOCHENPLAN") {
      return match.visibility.wochenplanVisible === false;
    }
    return true;
  });

  const upcoming: MatchcenterRowViewModel[] = [];
  const completed: MatchcenterMatchSummary[] = [];

  for (const match of wochenplanFiltered) {
    const lifecycle = resolveLifecycle(match, now);

    if (isSportingMatchInResultsList(lifecycle)) {
      completed.push(match);
      continue;
    }

    if (
      isSportingMatchInUpcomingList(lifecycle, { includePostponed: true })
    ) {
      upcoming.push({
        match,
        assessment: assessMatchOperationalState(match, now),
      });
    }
  }

  const upcomingCore = upcoming.filter((row) =>
    isSportingMatchInUpcomingList(resolveLifecycle(row.match, now)),
  );
  const offenCount = upcomingCore.filter(
    (row) => row.assessment.status === "OPEN",
  ).length;

  const kpis: MatchcenterKpis = {
    anstehend: upcomingCore.length,
    offen: offenCount,
    bereit: upcomingCore.length - offenCount,
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
