import {
  getCurrentSwissFootballSeason,
  getSwissFootballSeasonStartYearFromDate,
} from "@/lib/seasons/season-logic";

export function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTeamSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTeamSeasonDisplayName(teamName: string): string {
  return "FC Allschwil " + normalizeTeamName(teamName);
}

export function buildTeamSeasonShortName(teamName: string): string {
  return normalizeTeamName(teamName);
}

export function isFutureSeasonComparedToCurrentSeason(
  seasonStartDate: string | Date
): boolean {
  const selectedStartYear = getSwissFootballSeasonStartYearFromDate(seasonStartDate);
  const currentSeason = getCurrentSwissFootballSeason();

  if (selectedStartYear === null || !currentSeason) {
    return false;
  }

  return selectedStartYear > currentSeason.startYear;
}
