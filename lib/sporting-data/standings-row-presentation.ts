/**
 * lib/sporting-data/standings-row-presentation.ts
 *
 * Canonical standings row presentation shared by Team Cockpit and the public
 * website feed. Applies club-directory enrichment once and resolves logos via
 * the same identity helper on both surfaces.
 */

import type { StandingsClubEnrichment } from "@/lib/club-directory/standings-club-enrichment";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import type { SportingStandingRow } from "@/lib/sporting-data/standings-types";

export type PresentedStandingsRow = {
  readonly position: number;
  /** Provider display team name — never rewritten by enrichment. */
  readonly teamName: string;
  readonly shortName: string | null;
  readonly isCurrentTeam: boolean;
  readonly logoUrl: string | null;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly penaltyPoints: number | null;
};

export type PresentStandingsRowsInput = {
  readonly rows: readonly SportingStandingRow[];
  readonly currentExternalTeamId: number;
  readonly currentTeamShortName: string | null;
  readonly tenantLogoUrl: string | null;
  readonly enrichmentByProviderTeamId: ReadonlyMap<
    number,
    StandingsClubEnrichment
  >;
};

/**
 * Maps provider standings rows to the canonical enriched presentation used by
 * both authenticated cockpit and public website consumers.
 */
export function presentStandingsRows(
  input: PresentStandingsRowsInput,
): PresentedStandingsRow[] {
  return input.rows.map((row) => {
    const isCurrentTeam = row.externalTeamId === input.currentExternalTeamId;
    const enrichment = input.enrichmentByProviderTeamId.get(row.externalTeamId);

    return {
      position: row.position,
      teamName: row.teamName,
      shortName: isCurrentTeam
        ? input.currentTeamShortName ?? row.shortName
        : enrichment?.shortName ?? row.shortName,
      isCurrentTeam,
      logoUrl: resolveClubIdentityLogoUrl(
        {
          isOwnTeam: isCurrentTeam,
          externalLogoUrl: enrichment?.logoUrl ?? null,
        },
        input.tenantLogoUrl,
      ),
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
  });
}
