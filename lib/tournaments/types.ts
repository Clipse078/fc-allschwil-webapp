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

/**
 * "HOME" — FC Allschwil hosts on its own facilities (pitch/hall + Garderobe
 * allocation is operationally relevant). "AWAY" — an external/guest club
 * hosts; no FCA facility requirement applies. Mirrors the existing
 * MatchCenter Event.homeAway convention verbatim (see
 * lib/matchcenter/operational-state.ts) — null/unset is treated as HOME,
 * the same default MatchCenter already uses.
 */
export type TournamentHomeAway = "HOME" | "AWAY";

export type TournamentExternalClubReference = {
  id: string;
  name: string;
  shortName: string | null;
};

export type TournamentExternalTeamReference = {
  id: string;
  name: string;
  shortName: string | null;
  categoryLabel: string | null;
  club: TournamentExternalClubReference;
};

/**
 * Denormalised FacilityResource fields, mirroring the naming convention
 * used by TrainingAllocationDto (lib/training/types.ts) — always paired
 * with the allocation row's own `id` (never conflated with it).
 */
export type TournamentFacilityResourceFields = {
  facilityResourceId: string;
  facilityResourceCode: string;
  facilityResourceName: string;
  /** FacilityResourceType, denormalised as a plain string (see lib/training/types.ts convention). */
  facilityResourceType: string;
  facilityId: string;
  facilityName: string;
};

/** How a TournamentParticipant's identity is resolved. */
export type TournamentParticipantKind = "TEAM" | "EXTERNAL_TEAM" | "MANUAL";

export type TournamentParticipantDressingRoomAllocationDto = TournamentFacilityResourceFields & {
  /** The allocation row's own id (for removal) — distinct from facilityResourceId. */
  id: string;
  notes: string | null;
  displayOrder: number;
};

export type TournamentParticipantDto = {
  id: string;
  tournamentId: string;
  kind: TournamentParticipantKind;
  /** Resolved display name regardless of kind — for UI/list convenience. */
  displayName: string;
  team: TournamentTeamReference | null;
  externalTeam: TournamentExternalTeamReference | null;
  /** Only set when kind === "MANUAL" — see PRODUCT REQUIREMENT fallback note in schema.prisma. */
  manualLabel: string | null;
  displayOrder: number;
  dressingRoomAllocations: TournamentParticipantDressingRoomAllocationDto[];
  createdAt: string;
  updatedAt: string;
};

export type TournamentResourceAllocationDto = TournamentFacilityResourceFields & {
  /** The allocation row's own id (for removal) — distinct from facilityResourceId. */
  id: string;
  notes: string | null;
  displayOrder: number;
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
  /**
   * Legacy single-team reference (Event.teamId). Preserved for backward
   * compatibility with existing generic Event consumers (team-page
   * visibility, public feeds — see lib/events/public-event-feed.ts) which
   * predate multi-team participation. NOT the canonical participants list —
   * see `participants` below.
   */
  team: TournamentTeamReference | null;
  homeAway: TournamentHomeAway;
  /** Canonical multi-team participant list — see TOURNAMENTCENTER-01B. */
  participants: TournamentParticipantDto[];
  /** Tournament-level Spielfeld/Halle allocations. Only operationally relevant when homeAway === "HOME". */
  resourceAllocations: TournamentResourceAllocationDto[];
  visibility: {
    websiteVisible: boolean;
    infoboardVisible: boolean;
    homepageVisible: boolean;
    wochenplanVisible: boolean;
    teamPageVisible: boolean;
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
  /** HOME (FCA-hosted, default when unset) or AWAY (external/guest-hosted). */
  homeAway?: TournamentHomeAway;
  websiteVisible?: boolean;
  infoboardVisible?: boolean;
  homepageVisible?: boolean;
  wochenplanVisible?: boolean;
  teamPageVisible?: boolean;
};

// ── TOURNAMENTCENTER-01B — participant + allocation service inputs ───────────

/**
 * Exactly one of `teamId` / `externalTeamId` / `manualLabel` must be set —
 * validated by lib/tournaments/participant-service.ts, not by this type.
 */
export type CreateTournamentParticipantInput = {
  teamId?: string;
  externalTeamId?: string;
  manualLabel?: string;
  displayOrder?: number;
};

export type CreateTournamentResourceAllocationInput = {
  facilityResourceId: string;
  notes?: string | null;
  displayOrder?: number;
};

export type CreateTournamentParticipantAllocationInput = {
  facilityResourceId: string;
  notes?: string | null;
  displayOrder?: number;
};
