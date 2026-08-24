import type { TeamDetailData } from "@/lib/teams/queries";

export type TeamCockpitMetrics = {
  seasonName: string | null;
  /** User-facing season label — distinguishes missing current season from roster-only historical seasons. */
  seasonLabel: string;
  hasHistoricalSeasons: boolean;
  playerCount: number;
  trainerCount: number;
  competitionLabel: string | null;
  orgUnitName: string | null;
  categoryLabel: string;
  participationTypeLabel: string | null;
  isActive: boolean;
  /** TEAM-COCKPIT-04: reserved for future health-state derivation. */
  healthState: "neutral";
};

type BuildTeamCockpitMetricsInput = {
  team: TeamDetailData;
  categoryLabels: Record<string, string>;
  participationTypeLabels: Record<string, string>;
};

export function buildTeamCockpitMetrics({
  team,
  categoryLabels,
  participationTypeLabels,
}: BuildTeamCockpitMetricsInput): TeamCockpitMetrics {
  const activeSeason =
    team.teamSeasons.find((entry) => entry.id === team.currentTeamSeasonId) ?? null;
  const hasHistoricalSeasons = team.teamSeasons.length > 0;

  const seasonLabel = activeSeason
    ? activeSeason.season.name
    : hasHistoricalSeasons
      ? "Keine Saison im aktuellen Geschäftsjahr"
      : "Keine Saison";

  return {
    seasonName: activeSeason?.season.name ?? null,
    seasonLabel,
    hasHistoricalSeasons,
    playerCount: activeSeason?.playerSquadMembers?.length ?? 0,
    trainerCount: activeSeason?.trainerTeamMembers?.length ?? 0,
    competitionLabel: team.competition?.shortName ?? team.competition?.name ?? null,
    orgUnitName: team.currentSeasonOrgUnit?.name ?? team.orgUnit?.name ?? null,
    categoryLabel: categoryLabels[team.category] ?? team.category,
    participationTypeLabel: activeSeason
      ? participationTypeLabels[activeSeason.participationType] ??
        activeSeason.participationType
      : null,
    isActive: team.isActive,
    healthState: "neutral",
  };
}
