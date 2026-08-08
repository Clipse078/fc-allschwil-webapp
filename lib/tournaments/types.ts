/**
 * lib/tournaments/types.ts
 *
 * TOURNAMENTCENTER-01 — canonical DTO/input shapes for the TournamentCenter
 * MVP. Tournaments are NOT a new domain model: they are canonical `Event`
 * rows with `type: "TOURNAMENT"`. This module only adds a TournamentCenter-
 * shaped view over the existing Event schema — no duplication of Event's
 * columns as a second source of truth.
 */

export type TournamentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED"
  | "ARCHIVED";

export type TournamentTeamReference = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
};

export type TournamentSeasonReference = {
  id: string;
  key: string;
  name: string;
};

export type TournamentDto = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  source: string;
  startAt: string;
  endAt: string | null;
  meetingTime: string | null;
  location: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  resultLabel: string | null;
  remarks: string | null;
  season: TournamentSeasonReference;
  team: TournamentTeamReference | null;
  visibility: {
    websiteVisible: boolean;
    infoboardVisible: boolean;
    homepageVisible: boolean;
    wochenplanVisible: boolean;
    teamPageVisible: boolean;
  };
  allocation: {
    pitchCode: string | null;
    homeDressingRoomCode: string | null;
    awayDressingRoomCode: string | null;
  };
  reviewStage: string;
  createdAt: string;
  updatedAt: string;
};

export type ListTournamentsFilter = {
  /** When omitted, all statuses are returned. */
  status?: TournamentStatus[];
};

/** Re-exported for convenience so callers don't need a direct @prisma/client import. */
export type { EventStatus } from "@prisma/client";

export type UpdateTournamentInput = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  meetingTime?: Date | null;
  organizerName?: string | null;
  competitionLabel?: string | null;
  resultLabel?: string | null;
  remarks?: string | null;
  teamId?: string | null;
  websiteVisible?: boolean;
  infoboardVisible?: boolean;
  homepageVisible?: boolean;
  wochenplanVisible?: boolean;
  teamPageVisible?: boolean;
  pitchCode?: string | null;
  homeDressingRoomCode?: string | null;
  awayDressingRoomCode?: string | null;
};
