/**
 * lib/club-directory/participant.ts
 *
 * CLUB-DIRECTORY-01 — TournamentCenter / friendly-match readiness.
 *
 * TournamentCenter and manual friendly-match creation are explicitly out of
 * scope for this slice (see task ANTI-DRIFT / TOURNAMENTCENTER REQUIREMENT /
 * FRIENDLY MATCH REQUIREMENT sections). This module only defines the
 * canonical, provider-agnostic shape a future participant picker needs so
 * that "tenant Team" and "ExternalTeam" can be selected side by side without
 * retyping opponent data — e.g.:
 *
 *   FC Allschwil B2       (tenant Team)
 *   SV Muttenz B2         (ExternalTeam)
 *   FC Reinach B          (ExternalTeam)
 *   Concordia Basel B1    (ExternalTeam)
 *
 * No database access, no persistence — pure mapping functions only.
 */

export type TenantTeamParticipantRef = {
  kind: "TENANT_TEAM";
  teamId: string;
  label: string;
};

export type ExternalTeamParticipantRef = {
  kind: "EXTERNAL_TEAM";
  externalTeamId: string;
  externalClubId: string;
  label: string;
  clubLabel: string;
};

/** Discriminated union a future participant picker (Tournament / friendly match) can render uniformly. */
export type MatchParticipantRef = TenantTeamParticipantRef | ExternalTeamParticipantRef;

export type TenantTeamParticipantSource = {
  id: string;
  name: string;
};

export type ExternalTeamParticipantSource = {
  id: string;
  name: string;
  externalClubId: string;
};

export type ExternalClubParticipantSource = {
  id: string;
  name: string;
};

export function toTenantTeamParticipantRef(
  team: TenantTeamParticipantSource,
): TenantTeamParticipantRef {
  return { kind: "TENANT_TEAM", teamId: team.id, label: team.name };
}

/**
 * Builds the canonical participant reference for an ExternalTeam. Requires
 * the parent ExternalClub (not just its id) so the label always carries
 * enough context to disambiguate teams with identical short names across
 * different clubs (e.g. two different clubs both fielding a "B2").
 *
 * @throws {Error} if `club.id` does not match `team.externalClubId` — this
 *   would indicate the caller passed a mismatched club, defeating the
 *   entire purpose of the club/team split.
 */
export function toExternalTeamParticipantRef(
  team: ExternalTeamParticipantSource,
  club: ExternalClubParticipantSource,
): ExternalTeamParticipantRef {
  if (team.externalClubId !== club.id) {
    throw new Error(
      "toExternalTeamParticipantRef: team.externalClubId does not match club.id.",
    );
  }

  return {
    kind: "EXTERNAL_TEAM",
    externalTeamId: team.id,
    externalClubId: club.id,
    label: team.name,
    clubLabel: club.name,
  };
}
