export type MatchcenterTeamResolution =
  | "RESOLVED"
  | "UNRESOLVED";

export interface MatchcenterTeamReference {
  id: string;
  name: string;
}

export interface MatchcenterSide {
  providerTeamId: number | null;
  providerTeamName: string | null;
  canonicalTeamId: string | null;
  canonicalTeamName: string | null;
  displayName: string;
  resolution: MatchcenterTeamResolution;
  isOwnTeam: boolean;
}

export interface MatchcenterSource {
  eventSource: string;
  externalSource: string | null;
  externalSourceId: string | null;
  provider: string | null;
  externalMatchId: number | null;
  externalSeasonId: number | null;
  matchNumber: number | null;
}

export interface MatchcenterSynchronization {
  eventLastSyncedAt: Date | null;
  mappingLastSyncedAt: Date | null;
  detailSyncedAt: Date | null;
  providerMatchState: number | null;
  providerMatchStateName: string | null;
}

export interface MatchcenterOperationalFields {
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  meetingTime: Date | null;
  remarks: string | null;
}

export interface MatchcenterVisibility {
  websiteVisible: boolean;
  infoboardVisible: boolean;
  homepageVisible: boolean;
  wochenplanVisible: boolean;
  trainingsplanVisible: boolean;
  teamPageVisible: boolean;
}

export interface MatchcenterMatchSummary {
  id: string;
  tenantId: string;
  type: "MATCH";
  title: string;
  description: string | null;
  status: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  intermediateResultLabel: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  home: MatchcenterSide;
  away: MatchcenterSide;
  source: MatchcenterSource;
  synchronization: MatchcenterSynchronization;
  operational: MatchcenterOperationalFields;
  visibility: MatchcenterVisibility;
  reviewStage: string;
  publishedAt: Date | null;
}

export interface MatchcenterMatchDetail
  extends MatchcenterMatchSummary {
  organizerName: string | null;
  reviewRequestedAt: Date | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerDivisionId: number | null;
  providerDivisionName: string | null;
  providerRoundNumber: number | null;
  providerOrganisationId: number | null;
  providerPlaygroundId: number | null;
  providerVenueName: string | null;
  providerSeasonName: string | null;
}

export interface MatchcenterListInput {
  tenantId: string;
  from?: Date;
  to?: Date;
  limit?: number;
  now?: Date;
}

export interface MatchcenterDetailInput {
  tenantId: string;
  eventId: string;
}
