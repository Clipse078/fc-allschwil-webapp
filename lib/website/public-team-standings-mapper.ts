/**
 * lib/website/public-team-standings-mapper.ts
 *
 * Maps provider-neutral standings tables to public website DTOs.
 */

import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import type {
  SportingStandingsTable,
  SportingStandingRow,
} from "@/lib/sporting-data/standings-types";
import type {
  PublicTeamStandings,
  PublicTeamStandingRow,
} from "@/lib/website/types";

export type PublicTeamStandingsExternalTeamRecord = {
  shortName: string | null;
  logoUrl: string | null;
};

export type PublicTeamStandingsIdentityContext = {
  currentExternalTeamId: number;
  currentTeamName: string;
  currentTeamShortName: string | null;
  tenantLogoUrl: string | null;
  externalTeamByProviderId: ReadonlyMap<number, PublicTeamStandingsExternalTeamRecord>;
};

function mapStandingRow(
  row: SportingStandingRow,
  context: PublicTeamStandingsIdentityContext,
): PublicTeamStandingRow {
  const isCurrentTeam = row.externalTeamId === context.currentExternalTeamId;
  const externalTeam = context.externalTeamByProviderId.get(row.externalTeamId);

  const logoUrl = resolveClubIdentityLogoUrl(
    {
      isOwnTeam: isCurrentTeam,
      externalLogoUrl: externalTeam?.logoUrl ?? null,
    },
    context.tenantLogoUrl,
  );

  return {
    position: row.position,
    team: {
      name: row.teamName,
      shortName: isCurrentTeam
        ? context.currentTeamShortName
        : externalTeam?.shortName ?? row.shortName,
      logoUrl,
      isCurrentTeam,
    },
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.points,
    penaltyPoints: row.penaltyPoints,
  };
}

export function mapPublicTeamStandings(
  table: SportingStandingsTable,
  context: PublicTeamStandingsIdentityContext,
): PublicTeamStandings {
  return {
    competition: {
      name: table.competition.name,
      divisionName: table.competition.divisionName,
      groupName: table.competition.groupName,
    },
    rows: table.rows.map((row) => mapStandingRow(row, context)),
  };
}
