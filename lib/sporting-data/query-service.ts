/**
 * lib/sporting-data/query-service.ts
 *
 * TEAM-SFV-02B — canonical tenant-safe sporting match query engine.
 *
 * DB-backed only. Reuses Matchcenter identity/side resolution from
 * lib/matchcenter/query-service.ts — never duplicates opponent logic.
 */

import {
  getMatchcenterMatchDetail,
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import type { MatchcenterMatchDetail, MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { assessMatchOperationalState } from "@/lib/matchcenter/operational-state";
import {
  isSportingMatchInResultsList,
  isSportingMatchInUpcomingList,
} from "./lifecycle";
import {
  matchBelongsToSeasonScope,
  resolveSportingSeasonScope,
  type SeasonScopeDatabase,
} from "./season-scope";
import { buildSportingMatchView } from "./view";
import type {
  SportingMatchDetailInput,
  SportingMatchListInput,
  SportingMatchView,
} from "./types";

export type SportingQueryDatabase = MatchcenterQueryDatabase & SeasonScopeDatabase;

function sortAscending(views: SportingMatchView[]): SportingMatchView[] {
  return [...views].sort(
    (left, right) => left.startAt.getTime() - right.startAt.getTime(),
  );
}

function sortDescending(views: SportingMatchView[]): SportingMatchView[] {
  return [...views].sort(
    (left, right) => right.startAt.getTime() - left.startAt.getTime(),
  );
}

async function loadScopedMatchSummaries(
  database: SportingQueryDatabase,
  input: SportingMatchListInput,
): Promise<{
  scope: Awaited<ReturnType<typeof resolveSportingSeasonScope>>;
  matches: MatchcenterMatchSummary[];
}> {
  const scope = await resolveSportingSeasonScope(database, input);

  const matches = await listMatchcenterMatches(database, {
    tenantId: scope.tenantId,
    from: input.from,
    to: input.to,
    limit: input.limit,
    now: input.now,
  });

  const seasonScoped = matches.filter((match) =>
    matchBelongsToSeasonScope(match, {
      tenantId: scope.tenantId,
      seasonId: scope.seasonId,
      seasonKey: scope.seasonKey,
      teamId: scope.teamId,
      teamSeasonId: scope.teamSeasonId,
    }),
  );

  return { scope, matches: seasonScoped };
}

function toViews(
  matches: readonly MatchcenterMatchSummary[],
  options: {
    now?: Date;
    teamSeasonId?: string | null;
  },
): SportingMatchView[] {
  return matches.map((match) =>
    buildSportingMatchView(match, {
      now: options.now,
      teamSeasonId: options.teamSeasonId,
    }),
  );
}

export async function listTeamMatches(
  database: SportingQueryDatabase,
  input: SportingMatchListInput,
): Promise<SportingMatchView[]> {
  const { scope, matches } = await loadScopedMatchSummaries(database, input);
  return sortAscending(
    toViews(matches, {
      now: input.now,
      teamSeasonId: scope.teamSeasonId,
    }),
  );
}

export async function listUpcomingMatches(
  database: SportingQueryDatabase,
  input: SportingMatchListInput,
): Promise<SportingMatchView[]> {
  const { scope, matches } = await loadScopedMatchSummaries(database, input);

  return sortAscending(
    toViews(matches, {
      now: input.now,
      teamSeasonId: scope.teamSeasonId,
    }).filter((view) =>
      isSportingMatchInUpcomingList(view.lifecycle, {
        includePostponed: true,
      }),
    ),
  );
}

export async function listRecentResults(
  database: SportingQueryDatabase,
  input: SportingMatchListInput,
): Promise<SportingMatchView[]> {
  const { scope, matches } = await loadScopedMatchSummaries(database, input);

  return sortDescending(
    toViews(matches, {
      now: input.now,
      teamSeasonId: scope.teamSeasonId,
    }).filter((view) => isSportingMatchInResultsList(view.lifecycle)),
  );
}

export async function getSportingMatchDetail(
  database: SportingQueryDatabase,
  input: SportingMatchDetailInput,
): Promise<SportingMatchView | null> {
  const detail: MatchcenterMatchDetail | null = await getMatchcenterMatchDetail(
    database,
    {
      tenantId: input.tenantId,
      eventId: input.eventId,
    },
  );

  if (detail === null) {
    return null;
  }

  return buildSportingMatchView(detail, { now: input.now });
}

export { buildSportingMatchView } from "./view";
