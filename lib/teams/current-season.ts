/**
 * lib/teams/current-season.ts
 *
 * TEAMCENTER-UX-01C — canonical "current TeamSeason" resolution.
 *
 * Root cause of the cross-webapp Team/TeamSeason propagation defect:
 * "the Team's current TeamSeason" was independently re-implemented, with
 * different precedence/fallback rules, in at least five places:
 *
 *   - lib/teams/queries.ts#getTeamsListData
 *       resolved via an explicit `?season=` override, else the calendar-
 *       computed Swiss football season key, else Season.isActive.
 *   - lib/teams/queries.ts#getTeamDetailData
 *       resolved via Season.isActive, but — critically — fell back to
 *       `teamSeasons[0]` (the most recently *started* season, active or
 *       not) whenever no TeamSeason matched the flag. That silent
 *       fallback is exactly why the Team detail page could show a
 *       different "current" season than the Teams list for the same Team.
 *   - app/api/teams/route.ts (GET)
 *       a third, inline duplicate keyed off the calendar-computed season,
 *       never the DB's Season.isActive flag.
 *   - lib/training/queries.ts#findTeamSeasonsForTenant (TrainingCenter's
 *     "Neue Trainingsserie" team-season picker)
 *       ignored season currency entirely and filtered only by
 *       TeamSeason.status === "ACTIVE" — since nothing ever flips that
 *       status during a season rollover, every historical season's
 *       TeamSeason for a Team accumulates in this picker forever. This is
 *       the concretely observed defect: the picker can offer (or default
 *       to) a stale season's TeamSeason that no longer matches what the
 *       Teams UI treats as canonical/current for that Team.
 *   - lib/org/queries.ts#getOrgUnitById
 *       a fourth variant, keyed off Season.isActive only, with no
 *       override support.
 *
 * This module is now the single source of truth. Every consumer that needs
 * "the Team's current TeamSeason" — at the Prisma query level or when
 * picking from an already-fetched list — must go through these helpers
 * instead of re-deriving the rule locally.
 *
 * Canonical rule (matches the dominant pattern already used by the Season
 * admin surface, Dayplanner/Weekplanner and the public website — see
 * lib/seasons/queries.ts#getSeasonOptionsData and lib/planner/queries.ts):
 *   - An explicit season key (e.g. the Teams overview's "Saison wechseln"
 *     selector) always wins when provided.
 *   - Otherwise, the Season flagged `Season.isActive = true` is canonical.
 *
 * Deliberately NOT included: a further fallback to "the most recent
 * season" when nothing matches. For a *specific Team*, a missing match
 * means that Team has no TeamSeason in the canonical season — and every
 * surface must render that as "none" rather than silently substituting a
 * stale one. That silent substitution was the actual defect.
 */

export type CurrentTeamSeasonWhere = { season: { key: string } } | { season: { isActive: true } };

/**
 * Builds the Prisma `where` fragment for the `season` relation used to
 * scope a `teamSeason` (or `team.teamSeasons`) query to the canonical
 * current season.
 */
export function currentTeamSeasonWhere(explicitSeasonKey?: string | null): CurrentTeamSeasonWhere {
  const trimmed = explicitSeasonKey?.trim();
  return trimmed ? { season: { key: trimmed } } : { season: { isActive: true } };
}

/** Minimal shape required to pick the canonical current entry from an already-fetched list. */
export type TeamSeasonWithSeasonIdentity = {
  season: { key: string; isActive: boolean };
};

/**
 * Picks the canonical current TeamSeason from an already-fetched list
 * (e.g. `team.teamSeasons`), using the same precedence as
 * {@link currentTeamSeasonWhere}.
 *
 * Returns `null` when no entry matches — callers must treat that as "this
 * Team has no current-season TeamSeason" and must NOT substitute another
 * entry (e.g. the most recently created/started one).
 */
export function pickCurrentTeamSeason<T extends TeamSeasonWithSeasonIdentity>(
  teamSeasons: readonly T[],
  explicitSeasonKey?: string | null,
): T | null {
  const trimmed = explicitSeasonKey?.trim();

  if (trimmed) {
    return teamSeasons.find((ts) => ts.season.key === trimmed) ?? null;
  }

  return teamSeasons.find((ts) => ts.season.isActive) ?? null;
}
