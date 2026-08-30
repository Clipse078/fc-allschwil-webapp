"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";
import { Button } from "@/components/ui/Button";

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
  providerMapping?: ProviderMappingInfo;
  competition?: CompetitionInfo;
  currentTeamSeasonId?: string | null;
  currentParticipationType?: string | null;
  currentSeasonOrgUnit?: OrgUnitOption | null;
  currentSeasonPublication?: {
    seasonName: string;
    showNextMatch: boolean;
    showNextTournament: boolean;
  } | null;
};

type Props = {
  initialTeam: Team;
  canManage: boolean;
  availableOrgUnits: OrgUnitOption[];
  availableCompetitions: CompetitionOption[];
};

/**
 * TEAM-COCKPIT-PREMIUM-01E: restrained team identity editing on Übersicht.
 * Administrative season/destructive actions remain under /administration.
 */
export default function TeamOverviewSettingsSection({
  initialTeam,
  canManage,
  availableOrgUnits,
  availableCompetitions,
}: Props) {
  const [team, setTeam] = useState<Team>(initialTeam);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  useEffect(() => {
    setTeam(initialTeam);
  }, [initialTeam]);

  if (!canManage) {
    return null;
  }

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
    }));
  }

  function handlePublicationSaved(publication: {
    showNextMatch: boolean;
    showNextTournament: boolean;
  }) {
    setTeam((current) =>
      current.currentSeasonPublication
        ? {
            ...current,
            currentSeasonPublication: {
              ...current.currentSeasonPublication,
              showNextMatch: publication.showNextMatch,
              showNextTournament: publication.showNextTournament,
            },
          }
        : current,
    );
  }

  return (
    <div className="space-y-4" data-testid="team-overview-settings">
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
            currentSeasonPublication={team.currentSeasonPublication ?? null}
            canManage={canManage}
            onSaved={handleTeamSaved}
            onPublicationSaved={handlePublicationSaved}
            onCancelEdit={() => setIsEditingSettings(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
