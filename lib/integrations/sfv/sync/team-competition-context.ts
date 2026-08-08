/**
 * lib/integrations/sfv/sync/team-competition-context.ts
 *
 * CLUB-DIRECTORY-04 — External Team Competition Context.
 *
 * Investigation result (documented here, not guessed):
 *
 *   SFV's ranking endpoint (`GET /api/club/ranking`, `ClubRankingEntry` —
 *   already implemented and fetched every schedule sync run for
 *   CLUB-DIRECTORY-02C club-identity resolution, see club-identity.ts)
 *   reports `leagueName` and `groupName` PER TEAM (`teamId`) for EVERY team
 *   appearing in the tenant's current league/group standings — own teams
 *   AND opponents alike. This is exactly the "which league/group is this
 *   team competing in" fact CLUB-DIRECTORY-04 needs to distinguish
 *   identically-named external teams (e.g. four different SFV teams that
 *   all canonically display as "AC Rossoneri") — reported directly by the
 *   provider, never derived from a team name string.
 *
 *   No extra SFV call is required: `rankingEntries` is already fetched in
 *   schedule.ts for `buildProviderClubIdIndex`. This module builds a second,
 *   independent index from the exact same already-fetched data.
 *
 * Coverage limitation (documented, not silently guessed):
 *
 *   Exactly like `buildProviderClubIdIndex`, the ranking fetch only covers
 *   leagues/groups the tenant's OWN teams currently compete in. An opponent
 *   encountered only in a cup match, a friendly, or a league/group outside
 *   that coverage resolves to an all-null context this run — never a guess.
 *
 * Not an identity signal:
 *
 *   Unlike `providerClubId` (club-identity.ts), league/group context is
 *   purely descriptive — it is never used to resolve or merge canonical
 *   identity. When the SAME teamId is observed more than once in one run
 *   with different values (e.g. present in two ranking rows), the LAST
 *   entry observed wins — matching how every other provider-owned field on
 *   a *ProviderMapping row already behaves (see provider-sync.ts): "most
 *   recently reported wins", never a conflict error.
 */

import type { ClubRankingEntry } from "../client";

/** Real, provider-reported sporting context for one team this run. */
export type ProviderCompetitionContext = {
  leagueName: string | null;
  groupName: string | null;
};

const EMPTY_CONTEXT: ProviderCompetitionContext = { leagueName: null, groupName: null };

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a `teamId -> { leagueName, groupName }` index from the club's
 * ranking data (`ClubRankingEntry[]`, GET /api/club/ranking) — already
 * fetched elsewhere in the sync pipeline (see schedule.ts). Performs no
 * network calls itself. Pure and side-effect-free.
 *
 * Entries with neither a usable league name nor group name are skipped —
 * an empty/blank provider value is never recorded over a previously
 * observed real value from the same run.
 */
export function buildProviderCompetitionContextIndex(
  rankingEntries: readonly ClubRankingEntry[],
): ReadonlyMap<number, ProviderCompetitionContext> {
  const index = new Map<number, ProviderCompetitionContext>();

  for (const entry of rankingEntries) {
    if (!Number.isInteger(entry.teamId) || entry.teamId <= 0) continue;

    const leagueName = normalize(entry.leagueName);
    const groupName = normalize(entry.groupName);
    if (leagueName === null && groupName === null) continue;

    index.set(entry.teamId, { leagueName, groupName });
  }

  return index;
}

/**
 * Looks up the resolved competition context for a single teamId from a
 * pre-built index. Returns an all-null context when the teamId is not
 * covered by this run's ranking data, or when the caller passes no index
 * at all — never a guess, never derived from the team's name.
 */
export function resolveProviderCompetitionContext(
  index: ReadonlyMap<number, ProviderCompetitionContext> | undefined,
  teamId: number,
): ProviderCompetitionContext {
  return index?.get(teamId) ?? EMPTY_CONTEXT;
}
