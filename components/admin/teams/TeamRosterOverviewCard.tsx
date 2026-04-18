import TeamSquadManagementCard from "@/components/admin/teams/TeamSquadManagementCard";
import TeamTrainerManagementCard from "@/components/admin/teams/TeamTrainerManagementCard";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type SquadMember = {
  id: string;
  status: string;
  shirtNumber: number | null;
  positionLabel: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWebsiteVisible: boolean;
  sortOrder: number;
  remarks: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth?: string | null;
  };
};

type TrainerMember = {
  id: string;
  status: string;
  roleLabel: string | null;
  isWebsiteVisible: boolean;
  sortOrder: number;
  remarks: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
  };
};

type TeamSeasonItem = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  squadWebsiteVisible?: boolean;
  trainerTeamWebsiteVisible?: boolean;
  season: {
    id: string;
    key: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  playerSquadMembers?: SquadMember[];
  trainerTeamMembers?: TrainerMember[];
};

type Props = {
  teamId: string;
  teamAgeGroup: string | null;
  canManage: boolean;
  teamSeasons: TeamSeasonItem[];
};

function sortTeamSeasonsDesc(entries: TeamSeasonItem[]) {
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
}: Props) {
  const sortedSeasons = sortTeamSeasonsDesc(teamSeasons);

  return (
    <AdminSurfaceCard className="p-6">
      <div>
        <p className="fca-eyebrow">Roster Management</p>
        <h3 className="fca-heading mt-2">Spielerkader und Trainerteam</h3>
        <p className="fca-body-muted mt-3 max-w-3xl">
          Saisonbasierte Grundlage für Kaderverwaltung mit getrennten Bereichen
          für Spieler und Trainer – im selben FCA Premium UX Stil wie die Website.
        </p>
      </div>

      {sortedSeasons.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-5">
          Noch keine Team-Saisons vorhanden. Für die spätere Kader- und
          Trainerteam-Verwaltung wird mindestens eine Team-Saison benötigt.
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          {sortedSeasons.map((entry) => (
            <div key={entry.id} className="fca-section-card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="fca-eyebrow">Saison</p>
                  <h4 className="fca-subheading mt-2">{entry.season.name}</h4>
                  <p className="fca-body-muted mt-3">{entry.displayName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="fca-pill">
                    Kader Website: {entry.squadWebsiteVisible ? "An" : "Aus"}
                  </span>
                  <span className="fca-pill">
                    Trainer Website: {entry.trainerTeamWebsiteVisible ? "An" : "Aus"}
                  </span>
                  <span className="fca-pill">
                    Status: {entry.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                <TeamSquadManagementCard
                  teamId={teamId}
                  canManage={canManage}
                  teamSeason={{
                    id: entry.id,
                    displayName: entry.displayName,
                    shortName: entry.shortName,
                    status: entry.status,
                    squadWebsiteVisible: entry.squadWebsiteVisible ?? true,
                    season: entry.season,
                    teamAgeGroup,
                    playerSquadMembers: entry.playerSquadMembers ?? [],
                  }}
                />

                <TeamTrainerManagementCard
                  teamId={teamId}
                  canManage={canManage}
                  teamSeason={{
                    id: entry.id,
                    displayName: entry.displayName,
                    trainerTeamWebsiteVisible: entry.trainerTeamWebsiteVisible ?? true,
                    season: entry.season,
                    trainerTeamMembers: entry.trainerTeamMembers ?? [],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurfaceCard>
  );
}
