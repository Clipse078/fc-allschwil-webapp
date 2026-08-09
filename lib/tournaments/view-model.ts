/**
 * lib/tournaments/view-model.ts
 *
 * TOURNAMENTCENTER-01 — Anstehend/Vergangen partitioning, action filtering,
 * and KPI derivation for the TournamentCenter overview.
 *
 * Pure, synchronous aggregation over the tenant's full Tournament list (see
 * lib/tournaments/tournament-service.ts::listTournaments). No I/O, no React.
 */

import type { TournamentDto } from "./types";
import {
  assessTournamentOperationalState,
  isTournamentCompletedOrInactive,
  type TournamentOperationalAssessment,
} from "./operational-state";

export type TournamentTab = "ANSTEHEND" | "ARCHIV";
export type TournamentActionFilter = "ALLE" | "OFFEN" | "ERLEDIGT";

export type TournamentRowViewModel = {
  tournament: TournamentDto;
  assessment: TournamentOperationalAssessment;
};

export type TournamentKpis = {
  /** Non-completed/cancelled/archived tournaments (Anstehend population). */
  anstehend: number;
  /** Of those, tournaments with a genuine outstanding administrative gap. */
  offen: number;
  /** Of those, tournaments with no outstanding administrative gap. */
  bereit: number;
  /** Completed/cancelled/archived tournaments (Archiv population). */
  archiv: number;
};

export type TournamentCenterViewModel = {
  kpis: TournamentKpis;
  /** Anstehend rows, filtered by actionFilter, ascending by start date. */
  anstehend: TournamentRowViewModel[];
  /** Archiv rows, descending by start date (most recent first). */
  archiv: TournamentDto[];
};

function isValidActionFilter(value: string): value is TournamentActionFilter {
  return value === "ALLE" || value === "OFFEN" || value === "ERLEDIGT";
}

export function normalizeTournamentActionFilter(
  value: string | null | undefined,
): TournamentActionFilter {
  const upper = value?.trim().toUpperCase() ?? "";
  return isValidActionFilter(upper) ? upper : "ALLE";
}

export function normalizeTournamentTab(value: string | null | undefined): TournamentTab {
  return value?.trim().toUpperCase() === "ARCHIV" ? "ARCHIV" : "ANSTEHEND";
}

/**
 * Builds the full TournamentCenter view model from the tenant's Tournament
 * list: Anstehend/Archiv partitioning, action-filter application, and KPI
 * counts.
 *
 * KPI counts always reflect the FULL population (never the active action
 * filter) so switching Alle/Offen/Erledigt never changes the summary
 * numbers shown above the list.
 */
export function buildTournamentCenterViewModel(
  tournaments: readonly TournamentDto[],
  options: { actionFilter?: TournamentActionFilter } = {},
): TournamentCenterViewModel {
  const actionFilter = options.actionFilter ?? "ALLE";

  const upcoming: TournamentRowViewModel[] = [];
  const archived: TournamentDto[] = [];

  for (const tournament of tournaments) {
    if (isTournamentCompletedOrInactive(tournament)) {
      archived.push(tournament);
      continue;
    }
    upcoming.push({ tournament, assessment: assessTournamentOperationalState(tournament) });
  }

  const offenCount = upcoming.filter((row) => row.assessment.status === "OPEN").length;

  const kpis: TournamentKpis = {
    anstehend: upcoming.length,
    offen: offenCount,
    bereit: upcoming.length - offenCount,
    archiv: archived.length,
  };

  const filtered = upcoming.filter((row) => {
    if (actionFilter === "OFFEN") return row.assessment.status === "OPEN";
    if (actionFilter === "ERLEDIGT") return row.assessment.status !== "OPEN";
    return true;
  });

  const anstehend = [...filtered].sort(
    (a, b) => new Date(a.tournament.startAt).getTime() - new Date(b.tournament.startAt).getTime(),
  );

  const archiv = [...archived].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  return { kpis, anstehend, archiv };
}
