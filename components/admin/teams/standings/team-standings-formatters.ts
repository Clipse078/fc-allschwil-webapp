import type { TeamCockpitStandingsRow } from "@/lib/teams/team-cockpit-sporting-data";

export function formatStandingsGoalDifference(goalDifference: number): string {
  if (goalDifference > 0) {
    return `+${goalDifference}`;
  }

  return String(goalDifference);
}

export function formatStandingsGoals(goalsFor: number, goalsAgainst: number): string {
  return `${goalsFor}:${goalsAgainst}`;
}

export function formatStandingsRecord(row: TeamCockpitStandingsRow): string {
  return `${row.won}-${row.drawn}-${row.lost}`;
}

/**
 * Returns a restrained penalty-points note when the provider reports a
 * non-zero sanction. Provider `points` remain authoritative.
 */
export function formatStandingsPenaltyPoints(
  penaltyPoints: number | null,
): string | null {
  if (penaltyPoints == null || penaltyPoints === 0) {
    return null;
  }

  return `−${penaltyPoints} Strafpkt.`;
}
