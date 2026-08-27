/**
 * lib/sporting-data/standings-types.ts
 *
 * Provider-neutral standings representation for read-through provider data.
 * Intentionally free of SFV-specific naming — adapters map upstream payloads
 * into these shapes before website/public mappers consume them.
 */

export type SportingStandingsCompetition = {
  name: string;
  divisionName: string | null;
  groupName: string | null;
};

export type SportingStandingRow = {
  /** Authoritative table position from the provider. */
  position: number;
  /** Provider-scoped team identifier used for identity matching. */
  externalTeamId: number;
  teamName: string;
  shortName: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  penaltyPoints: number | null;
};

export type SportingStandingsTable = {
  competition: SportingStandingsCompetition;
  rows: SportingStandingRow[];
};
