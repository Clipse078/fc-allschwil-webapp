import type {
  TeamCockpitMatch,
  TeamCockpitResult,
  TeamCockpitStandings,
} from "@/lib/teams/team-cockpit-sporting-data";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import TeamSportingSnapshot from "./TeamSportingSnapshot";
import TeamTrainingSummary from "./TeamTrainingSummary";
import TeamCompositionSummary from "./TeamCompositionSummary";
import TeamOverviewOperationalLinks from "./TeamOverviewOperationalLinks";
import TeamOverviewSettingsSection from "./TeamOverviewSettingsSection";
import TeamPhotoSection from "./TeamPhotoSection";

type OrgUnitOption = {
  id: string;
  name: string;
  key: string;
  type: string;
};

type CompetitionOption = {
  id: string;
  officialName: string;
  shortName: string | null;
};

type Team = {
  id: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  infoboardDisplayName: string | null;
  infoboardTrainingDisplayName: string | null;
  infoboardMatchDisplayName: string | null;
  infoboardTournamentDisplayName: string | null;
  photoUrl?: string | null;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  orgUnitId: string | null;
  providerMapping?: {
    provider: string;
    teamName: string | null;
    isActive: boolean;
    lastSyncedAt: string;
  } | null;
  competition?: {
    id: string | null;
    name: string | null;
    shortName: string | null;
  } | null;
  currentTeamSeasonId?: string | null;
  currentParticipationType?: string | null;
  currentSeasonOrgUnit?: OrgUnitOption | null;
};

type Props = {
  team: Team;
  nextMatch: TeamCockpitMatch | null;
  latestResult: TeamCockpitResult | null;
  standings: TeamCockpitStandings | null;
  trainingSchedule: TeamTrainingScheduleEntry[];
  playerCount: number;
  trainerCount: number;
  formatConfig: TenantFormatConfig;
  canManage: boolean;
  canManagePhoto: boolean;
  availableOrgUnits: OrgUnitOption[];
  availableCompetitions: CompetitionOption[];
};

/**
 * TEAM-COCKPIT-PREMIUM-01E: concise Team Cockpit Übersicht content.
 * Shared identity, season, competition, and navigation live in layout.tsx.
 */
export default function TeamCockpitOverviewContent({
  team,
  nextMatch,
  latestResult,
  standings,
  trainingSchedule,
  playerCount,
  trainerCount,
  formatConfig,
  canManage,
  canManagePhoto,
  availableOrgUnits,
  availableCompetitions,
}: Props) {
  return (
    <div className="space-y-6" data-testid="team-cockpit-overview-content">
      <TeamPhotoSection
        teamId={team.id}
        teamDisplayName={team.shortName ?? team.name}
        initialPhotoUrl={team.photoUrl ?? null}
        canManagePhoto={canManagePhoto}
      />

      <TeamOverviewSettingsSection
        initialTeam={team}
        canManage={canManage}
        availableOrgUnits={availableOrgUnits}
        availableCompetitions={availableCompetitions}
      />

      <TeamSportingSnapshot
        teamId={team.id}
        nextMatch={nextMatch}
        latestResult={latestResult}
        standings={standings}
        formatConfig={formatConfig}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TeamTrainingSummary entries={trainingSchedule} />
        <TeamCompositionSummary
          teamId={team.id}
          playerCount={playerCount}
          trainerCount={trainerCount}
        />
      </div>

      <TeamOverviewOperationalLinks teamId={team.id} />
    </div>
  );
}
