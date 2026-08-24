"use client";

import { useState } from "react";
import TeamSquadManagementCard from "@/components/admin/teams/TeamSquadManagementCard";
import TeamTrainerManagementCard from "@/components/admin/teams/TeamTrainerManagementCard";

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

export type TeamRosterSeasonEntry = {
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
  entry: TeamRosterSeasonEntry;
  anchorTargets?: boolean;
};

export default function TeamRosterSeasonSection({
  teamId,
  teamAgeGroup,
  canManage,
  entry,
  anchorTargets = false,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">{entry.season.name}</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{entry.displayName}</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <TeamSquadManagementCard
          teamId={teamId}
          canManage={canManage}
          sectionId={anchorTargets ? "spielerkader" : undefined}
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
          sectionId={anchorTargets ? "trainerteam" : undefined}
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
  );
}

type HistoricalSeasonsProps = {
  teamId: string;
  teamAgeGroup: string | null;
  canManage: boolean;
  seasons: TeamRosterSeasonEntry[];
};

export function TeamHistoricalSeasonRosters({
  teamId,
  teamAgeGroup,
  canManage,
  seasons,
}: HistoricalSeasonsProps) {
  const [open, setOpen] = useState(false);

  if (seasons.length === 0) {
    return null;
  }

  return (
    <details
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
        Weitere Saisons ({seasons.length})
      </summary>
      <div className="space-y-8 border-t border-[var(--border)] px-4 py-4">
        {seasons.map((entry) => (
          <TeamRosterSeasonSection
            key={entry.id}
            teamId={teamId}
            teamAgeGroup={teamAgeGroup}
            canManage={canManage}
            entry={entry}
          />
        ))}
      </div>
    </details>
  );
}
