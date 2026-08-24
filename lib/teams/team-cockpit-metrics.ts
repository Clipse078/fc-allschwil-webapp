import type { TeamDetailData } from "@/lib/teams/queries";

export type TeamCockpitMetrics = {
  seasonName: string | null;
  playerCount: number;
  trainerCount: number;
  competitionLabel: string | null;
  orgUnitName: string | null;
  websiteVisible: boolean;
  infoboardVisible: boolean;
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

  return {
    seasonName: activeSeason?.season.name ?? null,
    playerCount: activeSeason?.playerSquadMembers?.length ?? 0,
    trainerCount: activeSeason?.trainerTeamMembers?.length ?? 0,
    competitionLabel: team.competition?.shortName ?? team.competition?.name ?? null,
    orgUnitName: team.currentSeasonOrgUnit?.name ?? team.orgUnit?.name ?? null,
    websiteVisible: team.websiteVisible,
    infoboardVisible: team.infoboardVisible,
    categoryLabel: categoryLabels[team.category] ?? team.category,
    participationTypeLabel: activeSeason
      ? participationTypeLabels[activeSeason.participationType] ??
        activeSeason.participationType
      : null,
    isActive: team.isActive,
    healthState: "neutral",
  };
}
