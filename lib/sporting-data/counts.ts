/**
 * lib/sporting-data/counts.ts
 *
 * TEAM-SFV-02B — canonical Matchcenter tab/KPI count semantics.
 */

import type { MatchcenterOperationalAssessment } from "@/lib/matchcenter/operational-state";
import {
  isSportingMatchInResultsList,
  isSportingMatchInUpcomingList,
  type SportingMatchLifecycle,
} from "./lifecycle";
import type { SportingMatchView } from "./types";

export type SportingMatchcenterKpis = {
  /** Genuinely upcoming fixtures (UPCOMING + LIVE). */
  anstehend: number;
  /** Upcoming fixtures with outstanding operational requirements. */
  offen: number;
  /** Upcoming fixtures with no outstanding operational requirements. */
  bereit: number;
  /** Definitively completed fixtures (canonical lifecycle COMPLETED). */
  resultate: number;
};

export type SportingMatchcenterRow = {
  view: SportingMatchView;
  assessment: MatchcenterOperationalAssessment;
};

function isOperationalOpen(assessment: MatchcenterOperationalAssessment): boolean {
  return assessment.status === "OPEN";
}

/**
 * Derives Matchcenter KPI counts from sporting lifecycle views.
 *
 * Counts never double-count the same match across upcoming and results.
 * POSTPONED matches are excluded from anstehend/offen/bereit but remain in
 * Spielplanung when callers include them via includePostponedInUpcoming.
 */
export function buildSportingMatchcenterKpis(
  rows: readonly SportingMatchcenterRow[],
  completed: readonly SportingMatchView[],
): SportingMatchcenterKpis {
  const upcomingCore = rows.filter((row) =>
    isSportingMatchInUpcomingList(row.view.lifecycle),
  );
  const offen = upcomingCore.filter((row) =>
    isOperationalOpen(row.assessment),
  ).length;

  return {
    anstehend: upcomingCore.length,
    offen,
    bereit: upcomingCore.length - offen,
    resultate: completed.length,
  };
}

export function assertNoUpcomingResultsOverlap(
  upcomingLifecycles: readonly SportingMatchLifecycle[],
  resultLifecycles: readonly SportingMatchLifecycle[],
): void {
  const upcomingIds = new Set(upcomingLifecycles);
  for (const lifecycle of resultLifecycles) {
    if (upcomingIds.has(lifecycle)) {
      throw new Error(
        "A match lifecycle cannot belong to both upcoming and results buckets.",
      );
    }
  }

  for (const lifecycle of upcomingLifecycles) {
    if (isSportingMatchInResultsList(lifecycle)) {
      throw new Error(
        "Completed lifecycle must not appear in the upcoming bucket.",
      );
    }
  }

  for (const lifecycle of resultLifecycles) {
    if (isSportingMatchInUpcomingList(lifecycle)) {
      throw new Error(
        "Upcoming lifecycle must not appear in the results bucket.",
      );
    }
  }
}
