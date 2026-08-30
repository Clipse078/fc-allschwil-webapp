/**
 * lib/website/public-team-standings-mapper.ts
 *
 * Maps provider-neutral standings tables to public website DTOs.
 */

import { presentStandingsRows } from "@/lib/sporting-data/standings-row-presentation";
import type { StandingsClubEnrichment } from "@/lib/club-directory/standings-club-enrichment";
import type { SportingStandingsTable } from "@/lib/sporting-data/standings-types";
import type {
  PublicTeamStandings,
  PublicTeamStandingRow,
} from "@/lib/website/types";

export type PublicTeamStandingsIdentityContext = {
  currentExternalTeamId: number;
  currentTeamName: string;
  currentTeamShortName: string | null;
  tenantLogoUrl: string | null;
  enrichmentByProviderTeamId: ReadonlyMap<number, StandingsClubEnrichment>;
};

/** @deprecated Use enrichmentByProviderTeamId on PublicTeamStandingsIdentityContext. */
export type PublicTeamStandingsExternalTeamRecord = {
  shortName: string | null;
  logoUrl: string | null;
};

function mapPresentedRow(
  row: ReturnType<typeof presentStandingsRows>[number],
): PublicTeamStandingRow {
  return {
    position: row.position,
    team: {
      name: row.teamName,
      shortName: row.shortName,
      logoUrl: row.logoUrl,
      isCurrentTeam: row.isCurrentTeam,
    },
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
    penaltyPoints: row.penaltyPoints,
  };
}

export function mapPublicTeamStandings(
  table: SportingStandingsTable,
  context: PublicTeamStandingsIdentityContext,
): PublicTeamStandings {
  const rows = presentStandingsRows({
    rows: table.rows,
    currentExternalTeamId: context.currentExternalTeamId,
    currentTeamShortName: context.currentTeamShortName,
    tenantLogoUrl: context.tenantLogoUrl,
    enrichmentByProviderTeamId: context.enrichmentByProviderTeamId,
  });

  return {
    competition: {
      name: table.competition.name,
      divisionName: table.competition.divisionName,
      groupName: table.competition.groupName,
    },
    rows: rows.map(mapPresentedRow),
  };
}
