import TeamSquadManagementCard from "@/components/admin/teams/TeamSquadManagementCard";
import TeamTrainerManagementCard from "@/components/admin/teams/TeamTrainerManagementCard";
import {
  TeamHistoricalSeasonRosters,
  type TeamRosterSeasonEntry,
} from "@/components/admin/teams/TeamRosterSeasonSection";

type Props = {
  teamId: string;
  teamAgeGroup: string | null;
  canManage: boolean;
  teamSeasons: TeamRosterSeasonEntry[];
  currentTeamSeasonId: string | null;
};

function sortTeamSeasonsDesc(entries: TeamRosterSeasonEntry[]) {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.season.startDate).getTime();
    const bTime = new Date(b.season.startDate).getTime();
    return bTime - aTime;
  });
}

export default function TeamRosterOverviewCard({
  teamId,
  teamAgeGroup,
  canManage,
  teamSeasons,
  currentTeamSeasonId,
}: Props) {
  const sortedSeasons = sortTeamSeasonsDesc(teamSeasons);
  const currentSeason = currentTeamSeasonId
    ? sortedSeasons.find((entry) => entry.id === currentTeamSeasonId) ?? null
    : null;
  const historicalSeasons = currentSeason
    ? sortedSeasons.filter((entry) => entry.id !== currentSeason.id)
    : sortedSeasons;

  return (
    <div className="space-y-6" data-testid="team-roster-overview">
      {currentSeason ? (
        <div className="grid gap-8 xl:grid-cols-2">
          <TeamSquadManagementCard
            teamId={teamId}
            canManage={canManage}
            sectionId="spielerkader"
            teamSeason={{
              id: currentSeason.id,
              displayName: currentSeason.displayName,
              shortName: currentSeason.shortName,
              status: currentSeason.status,
              squadWebsiteVisible: currentSeason.squadWebsiteVisible ?? true,
              season: currentSeason.season,
              teamAgeGroup,
              playerSquadMembers: currentSeason.playerSquadMembers ?? [],
            }}
          />

          <TeamTrainerManagementCard
            teamId={teamId}
            canManage={canManage}
            sectionId="trainerteam"
            teamSeason={{
              id: currentSeason.id,
              displayName: currentSeason.displayName,
              trainerTeamWebsiteVisible: currentSeason.trainerTeamWebsiteVisible ?? true,
              season: currentSeason.season,
              trainerTeamMembers: currentSeason.trainerTeamMembers ?? [],
            }}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-sm text-[var(--muted)]">
          {teamSeasons.length > 0
            ? "Für die aktuelle Geschäftsjahr-Saison ist kein Kader hinterlegt. Historische Saisons sind unten verfügbar."
            : "Noch keine Team-Saison vorhanden. Für Kader und Trainerteam wird mindestens eine Team-Saison benötigt."}
        </div>
      )}

      {historicalSeasons.length > 0 ? (
        <TeamHistoricalSeasonRosters
          teamId={teamId}
          teamAgeGroup={teamAgeGroup}
          canManage={canManage}
          seasons={historicalSeasons}
        />
      ) : null}
    </div>
  );
}
