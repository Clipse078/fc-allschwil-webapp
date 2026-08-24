"use client";

import { useEffect, useState } from "react";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";
import TeamRosterOverviewCard from "@/components/admin/teams/TeamRosterOverviewCard";

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
  // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
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
  // TEAM-IDENTITY-01: read-only provider identity/name. Never edited here.
  providerMapping?: ProviderMappingInfo;
  // TEAMCENTER-UX-01B: Liga/Wettbewerb, sourced from the canonical
  // TeamSeasonCompetition -> Competition relation of the current season.
  // TEAMCENTER-UX-01C: now editable via currentTeamSeasonId below — see
  // TeamSettingsCard.
  competition?: CompetitionInfo;
  // TEAMCENTER-UX-01C: the canonical current-season TeamSeason id (see
  // lib/teams/current-season.ts). Null when this Team has no TeamSeason in
  // the canonical current season — competition editing is disabled in that
  // case rather than silently targeting a stale/historical TeamSeason.
  currentTeamSeasonId?: string | null;
  currentParticipationType?: string | null;
  // TEAM-SEASON-ORGUNIT-01: primary OrgUnit for the current season.
  currentSeasonOrgUnit?: OrgUnitOption | null;
  teamSeasons: TeamSeasonItem[];
};

type Props = {
  initialTeam: Team;
  canManage: boolean;
  availableOrgUnits: OrgUnitOption[];
  availableCompetitions: CompetitionOption[];
};

export default function TeamDetailCard({
  initialTeam,
  availableOrgUnits,
  availableCompetitions,
  canManage,
}: Props) {
  const [team, setTeam] = useState<Team>(initialTeam);

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
      // Reset orgUnit object when orgUnitId changes — server page revalidation provides the full object.
      orgUnit: updatedTeamBase.orgUnitId === current.orgUnitId ? current.orgUnit : null,
    }));
  }

  return (
    <div className="space-y-6">
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
      />

      {/*
       * TEAMCENTER-UX-01B (H): the previous duplicated "Saison Verwaltung" /
       * "Team-Saison hinzufügen" (TeamSeasonCreateCard) and "Saison
       * Übersicht" / "Team-Saisons" (TeamSeasonListCard, TeamSeasonEditForm)
       * management surfaces have been removed from this page. They
       * duplicated the canonical Team settings above (name/visibility) and
       * created ambiguity over which value was authoritative — see
       * lib/teams/team-naming.ts. TeamSeason data/schema/services are
       * untouched; only this duplicated edit UX was removed.
       */}

      <TeamRosterOverviewCard
        teamId={team.id}
        teamAgeGroup={team.ageGroup}
        canManage={canManage}
        teamSeasons={team.teamSeasons}
      />
    </div>
  );
}
