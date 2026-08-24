import { SectionCard } from "@/components/ui/page";
import TeamRosterSeasonSection, {
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
  const currentSeason =
    sortedSeasons.find((entry) => entry.id === currentTeamSeasonId) ??
    sortedSeasons[0] ??
    null;
  const historicalSeasons = currentSeason
    ? sortedSeasons.filter((entry) => entry.id !== currentSeason.id)
    : [];

  return (
    <SectionCard
      title="Kader & Trainerteam"
      description="Saisonbasierter Spielerkader und Trainerteam — eine kanonische Verwaltungsoberfläche."
    >
      {currentSeason ? (
        <TeamRosterSeasonSection
          teamId={teamId}
          teamAgeGroup={teamAgeGroup}
          canManage={canManage}
          entry={currentSeason}
          anchorTargets
          compact
        />
      ) : (
        <div className="fca-status-box fca-status-box-muted">
          Noch keine Team-Saison vorhanden. Für die Kader- und Trainerteam-Verwaltung
          wird mindestens eine Team-Saison benötigt.
        </div>
      )}

      {historicalSeasons.length > 0 ? (
        <div className="mt-5">
          <TeamHistoricalSeasonRosters
            teamId={teamId}
            teamAgeGroup={teamAgeGroup}
            canManage={canManage}
            seasons={historicalSeasons}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
