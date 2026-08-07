"use client";

import { useEffect, useState } from "react";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";
import TeamSeasonCreateCard from "@/components/admin/teams/TeamSeasonCreateCard";
import TeamSeasonListCard from "@/components/admin/teams/TeamSeasonListCard";
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

type SavedTeamSeasonPayload = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: TeamSeasonStatus;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  season: {
    id: string;
    key: string;
    name: string;
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

type Team = {
  id: string;
  name: string;
  // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
  shortName: string | null;
  alternativeName: string | null;
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
  teamSeasons: TeamSeasonItem[];
};

type SeasonOption = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date | string;
  endDate: Date | string;
};

type Props = {
  initialTeam: Team;
  availableSeasons: SeasonOption[];
  availableOrgUnits: OrgUnitOption[];
  canManage: boolean;
};

function sortTeamSeasonsDesc(entries: TeamSeasonItem[]) {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.season.startDate).getTime();
    const bTime = new Date(b.season.startDate).getTime();

    return bTime - aTime;
  });
}

export default function TeamDetailCard({
  initialTeam,
  availableSeasons,
  availableOrgUnits,
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

  function handleSeasonSaved(updatedEntry: SavedTeamSeasonPayload) {
    setTeam((current) => ({
      ...current,
      teamSeasons: sortTeamSeasonsDesc(
        current.teamSeasons.map((entry) =>
          entry.id === updatedEntry.id
            ? {
                ...entry,
                id: updatedEntry.id,
                displayName: updatedEntry.displayName,
                shortName: updatedEntry.shortName,
                status: updatedEntry.status,
                websiteVisible: updatedEntry.websiteVisible,
                infoboardVisible: updatedEntry.infoboardVisible,
                season: {
                  ...entry.season,
                  id: updatedEntry.season.id,
                  key: updatedEntry.season.key,
                  name: updatedEntry.season.name,
                  isActive: updatedEntry.season.isActive,
                },
              }
            : entry
        )
      ),
    }));
  }

  function handleSeasonCreated(createdEntry: TeamSeasonItem) {
    setTeam((current) => ({
      ...current,
      teamSeasons: sortTeamSeasonsDesc([...current.teamSeasons, createdEntry]),
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
          teamSeasons: team.teamSeasons.map((entry) => ({
            id: entry.id,
            season: entry.season,
          })),
        }}
        availableOrgUnits={availableOrgUnits}
        canManage={canManage}
        onSaved={handleTeamSaved}
      />

      <TeamSeasonCreateCard
        teamId={team.id}
        teamName={team.name}
        canManage={canManage}
        availableSeasons={availableSeasons}
        existingTeamSeasons={team.teamSeasons}
        onCreated={handleSeasonCreated}
      />

      <TeamSeasonListCard
        teamId={team.id}
        canManage={canManage}
        teamSeasons={team.teamSeasons}
        onSaved={handleSeasonSaved}
      />

      <TeamRosterOverviewCard
        teamId={team.id}
        teamAgeGroup={team.ageGroup}
        canManage={canManage}
        teamSeasons={team.teamSeasons}
      />
    </div>
  );
}
