export type MatchcenterTeamResolution =
  | "RESOLVED"
  | "UNRESOLVED";

export interface MatchcenterTeamReference {
  id: string;
  name: string;
  shortName?: string | null;
  alternativeName?: string | null;
}

export interface MatchcenterSide {
  providerTeamId: number | null;
  providerTeamName: string | null;
  canonicalTeamId: string | null;
  canonicalTeamName: string | null;
  /**
   * TEAM-IDENTITY-01 canonical SHORT NAME (Team.shortName), when the side
   * resolves to a canonical Team. Optional so existing fixtures/tests that
   * predate TEAM-IDENTITY-01 compact naming keep compiling unchanged.
   * Use lib/matchcenter/team-display.ts to resolve the compact display name
   * rather than reading this field directly.
   */
  canonicalTeamShortName?: string | null;
  /**
   * TEAM-IDENTITY-01 canonical ALTERNATIVE NAME (Team.alternativeName).
   * See canonicalTeamShortName above.
   */
  canonicalTeamAlternativeName?: string | null;
  /** Long-form display name (TEAM-IDENTITY-01 long resolver). */
  displayName: string;
  resolution: MatchcenterTeamResolution;
  isOwnTeam: boolean;
  /**
   * CLUB-DIRECTORY-02 — canonical Club Directory identity for this side,
   * when it resolves to a discovered/linked ExternalTeam (never set for the
   * tenant's own side — that identity lives exclusively in
   * canonicalTeamId/canonicalTeamName above). Reuses the canonical
   * ExternalClub/ExternalTeam directory instead of introducing a second
   * opponent representation; see lib/club-directory/discovery-service.ts.
   */
  canonicalExternalTeamId?: string | null;
  canonicalExternalClubId?: string | null;
  canonicalExternalTeamName?: string | null;
  canonicalExternalTeamShortName?: string | null;
  canonicalExternalTeamAlternativeName?: string | null;
  /**
   * Effective logo URL for the resolved ExternalTeam (team-level override,
   * falling back to the parent ExternalClub's crest — see
   * lib/club-directory/logo.ts resolveExternalTeamLogoUrl). Null when no
   * canonical external identity is resolved yet, or no logo is set.
   */
  externalLogoUrl?: string | null;
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
  /** Canonical Event.teamId — the tenant-owned team assigned to this match. */
  teamId: string | null;
  /** Canonical Event.seasonId — used for season isolation in sporting queries. */
  seasonId: string | null;
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
