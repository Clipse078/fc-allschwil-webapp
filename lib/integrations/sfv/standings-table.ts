/**
 * lib/integrations/sfv/standings-table.ts
 *
 * Pure SFV adapter for resolving the authoritative ranking table for a team.
 * Position values come from SFV and are never recalculated locally.
 */

import type { ClubRankingEntry } from "./client";
import type {
  SportingStandingsCompetition,
  SportingStandingRow,
  SportingStandingsTable,
} from "@/lib/sporting-data/standings-types";

export type StandingsTableResolutionInput = {
  entries: readonly ClubRankingEntry[];
  externalTeamId: number;
  providerLeagueId?: number | null;
};

type TableTuple = {
  leagueId: number;
  divisionId: number;
  groupId: number;
};

function tableTuple(entry: ClubRankingEntry): TableTuple {
  return {
    leagueId: entry.leagueId,
    divisionId: entry.divisionId,
    groupId: entry.groupId,
  };
}

function tuplesEqual(left: TableTuple, right: TableTuple): boolean {
  return (
    left.leagueId === right.leagueId &&
    left.divisionId === right.divisionId &&
    left.groupId === right.groupId
  );
}

function compareTableTuples(left: TableTuple, right: TableTuple): number {
  if (left.leagueId !== right.leagueId) {
    return left.leagueId - right.leagueId;
  }

  if (left.divisionId !== right.divisionId) {
    return left.divisionId - right.divisionId;
  }

  return left.groupId - right.groupId;
}

function meaningfulName(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRow(entry: ClubRankingEntry): SportingStandingRow {
  return {
    position: entry.position,
    externalTeamId: entry.teamId,
    teamName: meaningfulName(entry.teamName) ?? `Team ${entry.teamId}`,
    shortName: null,
    played: entry.matches,
    won: entry.wins,
    drawn: entry.draws,
    lost: entry.losses,
    goalsFor: entry.goalsFor,
    goalsAgainst: entry.goalsAgainst,
    points: entry.points,
    penaltyPoints: entry.penaltyPoints,
  };
}

function buildCompetition(
  anchor: ClubRankingEntry,
): SportingStandingsCompetition {
  return {
    name: meaningfulName(anchor.leagueName) ?? "League",
    divisionName: meaningfulName(anchor.divisionName),
    groupName: meaningfulName(anchor.groupName),
  };
}

/**
 * Resolves the authoritative ranking table for a mapped external team.
 *
 * Returns null when the team does not appear in any ranking table.
 */
export function resolveStandingsTable(
  input: StandingsTableResolutionInput,
): SportingStandingsTable | null {
  const anchors = input.entries.filter(
    (entry) => entry.teamId === input.externalTeamId,
  );

  if (anchors.length === 0) {
    return null;
  }

  let selectedAnchor = anchors[0]!;

  if (anchors.length > 1 && input.providerLeagueId != null) {
    const leagueMatches = anchors.filter(
      (entry) => entry.leagueId === input.providerLeagueId,
    );

    if (leagueMatches.length === 1) {
      selectedAnchor = leagueMatches[0]!;
    } else if (leagueMatches.length > 1) {
      selectedAnchor = [...leagueMatches].sort((left, right) =>
        compareTableTuples(tableTuple(left), tableTuple(right)),
      )[0]!;
    } else {
      selectedAnchor = [...anchors].sort((left, right) =>
        compareTableTuples(tableTuple(left), tableTuple(right)),
      )[0]!;
    }
  } else if (anchors.length > 1) {
    selectedAnchor = [...anchors].sort((left, right) =>
      compareTableTuples(tableTuple(left), tableTuple(right)),
    )[0]!;
  }

  const anchorTuple = tableTuple(selectedAnchor);
  const tableRows = input.entries
    .filter((entry) => tuplesEqual(tableTuple(entry), anchorTuple))
    .sort((left, right) => left.position - right.position)
    .map(mapRow);

  return {
    competition: buildCompetition(selectedAnchor),
    rows: tableRows,
  };
}
