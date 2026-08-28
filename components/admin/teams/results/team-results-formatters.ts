import type {
  TeamCockpitMatch,
  TeamCockpitResult,
  TeamCockpitResultPerspective,
} from "@/lib/teams/team-cockpit-sporting-data";
import {
  formatFixtureDateLine,
  formatFixtureTime,
} from "@/components/admin/teams/upcoming-matches/team-upcoming-matches-formatters";

export { formatFixtureDateLine, formatFixtureTime };

const RESULT_PERSPECTIVE_LABELS: Record<TeamCockpitResultPerspective, string> = {
  WON: "Sieg",
  DRAW: "Unentschieden",
  LOST: "Niederlage",
  UNKNOWN: "",
};

export function formatResultScore(result: TeamCockpitResult): string {
  if (result.scoreHome == null || result.scoreAway == null) {
    return "–";
  }

  return `${result.scoreHome} : ${result.scoreAway}`;
}

export function resolveResultPerspectiveLabel(
  perspective: TeamCockpitResultPerspective,
): string {
  return RESULT_PERSPECTIVE_LABELS[perspective];
}

export function resolveResultHomeAwayLabel(side: TeamCockpitMatch["side"]): string {
  return side === "HOME" ? "Heim" : "Auswärts";
}

export function resolveResultVenueLabel(match: TeamCockpitMatch): string | null {
  const venueName = match.venueName?.trim();
  if (venueName) {
    return venueName;
  }

  const location = match.location?.trim();
  return location && location.length > 0 ? location : null;
}
