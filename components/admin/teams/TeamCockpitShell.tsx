"use client";

import { useEffect, useState } from "react";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";
import TeamRosterOverviewCard from "@/components/admin/teams/TeamRosterOverviewCard";
import TeamCockpitHeaderBar from "@/components/admin/teams/TeamCockpitHeaderBar";
import TeamCockpitOverview from "@/components/admin/teams/TeamCockpitOverview";
import TeamTrainingSchedule from "@/components/admin/teams/TeamTrainingSchedule";
import TeamAdministrationSection from "@/components/admin/teams/TeamAdministrationSection";
import type { TeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";
import { SectionCard } from "@/components/ui/page";

type TeamSeasonStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type TeamSeasonItem = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: TeamSeasonStatus;
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
  playerSquadMembers?: Array<{
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
  }>;
  trainerTeamMembers?: Array<{
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
  }>;
};

type OrgUnitOption = {
  id: string;
  name: string;
  key: string;
  type: string;
};

type ProviderMappingInfo = {
  provider: string;
  teamName: string | null;
  isActive: boolean;
  lastSyncedAt: string;
} | null;

type CompetitionInfo = {
  id: string;
  name: string | null;
  shortName: string | null;
} | null;

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
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  orgUnitId: string | null;
  orgUnit: OrgUnitOption | null;
  providerMapping?: ProviderMappingInfo;
  competition?: CompetitionInfo;
  currentTeamSeasonId?: string | null;
  currentParticipationType?: string | null;
  currentSeasonOrgUnit?: OrgUnitOption | null;
  teamSeasons: TeamSeasonItem[];
};

type Props = {
  initialTeam: Team;
  cockpitMetrics: TeamCockpitMetrics;
  trainingSchedule: TeamTrainingScheduleEntry[];
  canManage: boolean;
  canDelete: boolean;
  availableOrgUnits: OrgUnitOption[];
  availableCompetitions: CompetitionOption[];
  displayTitle: string;
};

export default function TeamCockpitShell({
  initialTeam,
  cockpitMetrics,
  trainingSchedule,
  canManage,
  canDelete,
  availableOrgUnits,
  availableCompetitions,
  displayTitle,
}: Props) {
  const [team, setTeam] = useState<Team>(initialTeam);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  useEffect(() => {
    setTeam(initialTeam);
  }, [initialTeam]);

  function handleTeamSaved(updatedTeamBase: {
    id: string;
    name: string;
    shortName: string | null;
    alternativeName: string | null;
    infoboardDisplayName: string | null;
    infoboardTrainingDisplayName: string | null;
    infoboardMatchDisplayName: string | null;
    infoboardTournamentDisplayName: string | null;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
    sortOrder: number;
    isActive: boolean;
    websiteVisible: boolean;
    infoboardVisible: boolean;
    orgUnitId: string | null;
  }) {
    setTeam((current) => ({
      ...current,
      ...updatedTeamBase,
      orgUnit: updatedTeamBase.orgUnitId === current.orgUnitId ? current.orgUnit : null,
    }));
  }

  return (
    <div className="space-y-6">
      <TeamCockpitHeaderBar
        teamId={team.id}
        websiteVisible={team.websiteVisible}
        infoboardVisible={team.infoboardVisible}
        canManage={canManage}
        isEditingSettings={isEditingSettings}
        onEditSettings={() => setIsEditingSettings(true)}
        onCancelEditSettings={() => setIsEditingSettings(false)}
        onVisibilityChange={(values) =>
          setTeam((current) => ({
            ...current,
            websiteVisible: values.websiteVisible,
            infoboardVisible: values.infoboardVisible,
          }))
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard title="Team-Übersicht" description="Operative Kennzahlen der aktuellen Saison.">
          <TeamCockpitOverview metrics={cockpitMetrics} />
        </SectionCard>

        <TeamTrainingSchedule entries={trainingSchedule} />
      </div>

      {/* TEAM-COCKPIT-02: future sport-data slot (matches, results, standings). */}
      <div data-testid="team-cockpit-sport-slot" className="hidden" aria-hidden="true" />

      {isEditingSettings ? (
        <div data-testid="team-settings-card">
          <TeamSettingsCard
            team={{
              id: team.id,
              name: team.name,
              shortName: team.shortName,
              alternativeName: team.alternativeName,
              infoboardDisplayName: team.infoboardDisplayName,
              infoboardTrainingDisplayName: team.infoboardTrainingDisplayName,
              infoboardMatchDisplayName: team.infoboardMatchDisplayName,
              infoboardTournamentDisplayName: team.infoboardTournamentDisplayName,
              slug: team.slug,
              category: team.category,
              genderGroup: team.genderGroup,
              ageGroup: team.ageGroup,
              sortOrder: team.sortOrder,
              isActive: team.isActive,
              websiteVisible: team.websiteVisible,
              infoboardVisible: team.infoboardVisible,
              orgUnitId: team.orgUnitId,
              providerMapping: team.providerMapping,
              competition: team.competition,
            }}
            availableOrgUnits={availableOrgUnits}
            availableCompetitions={availableCompetitions}
            currentTeamSeasonId={team.currentTeamSeasonId ?? null}
            currentParticipationType={team.currentParticipationType ?? null}
            currentSeasonOrgUnit={team.currentSeasonOrgUnit ?? null}
            canManage={canManage}
            onSaved={handleTeamSaved}
            onCancelEdit={() => setIsEditingSettings(false)}
          />
        </div>
      ) : null}

      <TeamRosterOverviewCard
        teamId={team.id}
        teamAgeGroup={team.ageGroup}
        canManage={canManage}
        teamSeasons={team.teamSeasons}
        currentTeamSeasonId={team.currentTeamSeasonId ?? null}
      />

      <TeamAdministrationSection
        teamId={team.id}
        teamName={displayTitle}
        isActive={team.isActive}
        canManage={canManage}
        canDelete={canDelete}
        teamSeasons={team.teamSeasons.map((teamSeason) => ({
          id: teamSeason.id,
          displayName: teamSeason.displayName,
          season: { name: teamSeason.season.name },
        }))}
      />
    </div>
  );
}
