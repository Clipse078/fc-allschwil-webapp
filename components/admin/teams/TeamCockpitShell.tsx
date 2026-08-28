"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";
import TeamCockpitOverview from "@/components/admin/teams/TeamCockpitOverview";
import TeamTrainingSchedule from "@/components/admin/teams/TeamTrainingSchedule";
import type { TeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/Button";

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
  id: string | null;
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
  availableOrgUnits,
  availableCompetitions,
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
      {canManage ? (
        <div className="flex justify-end">
          {isEditingSettings ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<X className="h-3.5 w-3.5" />}
              onClick={() => setIsEditingSettings(false)}
            >
              Bearbeiten beenden
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => setIsEditingSettings(true)}
              data-testid="team-settings-edit-button"
            >
              Bearbeiten
            </Button>
          )}
        </div>
      ) : null}

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
    </div>
  );
}
