/**
 * lib/integrations/sfv/sync/club-identity.ts
 *
 * CLUB-DIRECTORY-02C — Canonical Club Consolidation & Logo Completeness.
 *
 * ─── Investigation result (documented here, not guessed) ──────────────────────
 *
 * The task required determining whether SFV exposes ANY stable, provider-
 * assigned club identity before implementing any consolidation. It does:
 *
 *   | Source                                   | Field                | Coverage |
 *   |-------------------------------------------|----------------------|----------|
 *   | GET /api/team/list (`fetchTeamList`)      | `TeamDetail.clubNumber` | The configured club's OWN teams only (already fetched every schedule sync run for participant classification — see schedule.ts `clubTeamList`). |
 *   | GET /api/club/ranking (`fetchClubRanking`)| `ClubRankingEntry.clubNumber` | EVERY team appearing in the tenant's league/group standings tables — own teams AND opponents alike. Already implemented and tested (`lib/integrations/sfv/client.ts#fetchClubRanking`, `__tests__/club-ranking.test.ts`), and already composed with opponent resolution one layer up (`lib/integrations/sfv/opponent-identity.ts#resolveRankingOpponentIdentity`, `lib/integrations/sfv/club-data-service.ts`) — this module is the first to route that clubNumber into the Club Directory's own `providerClubId` field. |
 *   | GET /api/club/schedule (`fetchClubSchedule`) | — | No club-level identifier for either schedule side; teamId/teamName only. This is why CLUB-DIRECTORY-02 originally fell back to "one club per opponent team". |
 *
 * `clubNumber` is exactly the field `ExternalClubProviderMapping.providerClubId`
 * / `ExternalTeamProviderMapping.providerClubId` already reserved for since
 * CLUB-DIRECTORY-01 ("Provider-assigned numeric club identifier (SFV:
 * TeamDetail.clubNumber)") — no schema change, no new field, no guessed
 * identity. It satisfies IDENTITY REQUIREMENT priority #1 ("stable SFV club
 * ID") for every teamId that appears in `TeamDetail` or in a ranking row this
 * run. Suffixes ("B1", "C2", "D7 gelb", "rot", "weiss", …) are never
 * inspected — clubNumber is a provider-assigned integer, structurally
 * unrelated to any team-name string.
 *
 * ─── Coverage limitation (documented, not silently guessed) ───────────────────
 *
 * `fetchClubRanking({ SeasonId, ClubId })` (no League/Division/Group filter)
 * returns the standings for every league/group the tenant's OWN teams
 * currently compete in — which includes every opponent CURRENTLY sharing one
 * of those groups, but NOT an opponent encountered only in a cup match, a
 * friendly, or a league/group the ranking response does not cover this
 * fetch. For such an opponent this run, `resolveProviderClubId()` below
 * correctly returns `null` — not a guess, not a name-derived value — and the
 * caller (discovery-service.ts) falls back to its narrow, documented
 * "dedicated club per team" behaviour for that one team. The consolidation
 * service (lib/club-directory/consolidation-service.ts) later reconciles it
 * once identity evidence becomes available (e.g. once a subsequent sync's
 * ranking fetch does cover that team, or once it appears in `TeamDetail` as
 * an own-club team after a transfer).
 *
 * ─── Conflict guard ─────────────────────────────────────────────────────────
 *
 * If the SAME teamId is ever seen with two DIFFERENT clubNumbers within one
 * run (own-team `TeamDetail` disagreeing with a ranking row, or two ranking
 * rows disagreeing with each other — not expected from a consistent
 * provider, but never assumed), that teamId is excluded from the index
 * entirely rather than guessing which value is correct. This is a defensive
 * "avoid false consolidation" guard, not a normal code path — see
 * `buildProviderClubIdIndex`'s `conflicts` return field, which the caller
 * logs (see `logClubIdentityConflict` in schedule-logging.ts) so a genuine
 * provider inconsistency is diagnosable rather than silently swallowed.
 */

import type { ClubRankingEntry, TeamDetail } from "../client";

/** One teamId whose clubNumber could not be determined unambiguously this run. */
export type ProviderClubIdConflict = {
  teamId: number;
  observedClubIds: number[];
};

export type ProviderClubIdIndexResult = {
  /** teamId → clubNumber, for every teamId with exactly one observed clubNumber. */
  indexByTeamId: ReadonlyMap<number, number>;
  /** teamIds excluded from the index because they had conflicting clubNumbers. */
  conflicts: ProviderClubIdConflict[];
};

/**
 * Builds a `teamId -> clubNumber` index from the club's own team list
 * (`TeamDetail[]`, GET /api/team/list) and the club's ranking data
 * (`ClubRankingEntry[]`, GET /api/club/ranking) — both already fetched
 * elsewhere in the sync pipeline for other purposes; this function performs
 * no network calls itself.
 *
 * Pure and side-effect-free: never throws, never mutates its inputs. Safe to
 * call with empty arrays (e.g. when the ranking fetch failed this run — see
 * schedule.ts, which treats that failure as best-effort and passes `[]`).
 */
export function buildProviderClubIdIndex(
  ownTeams: readonly TeamDetail[],
  rankingEntries: readonly ClubRankingEntry[],
): ProviderClubIdIndexResult {
  const observed = new Map<number, Set<number>>();

  function record(teamId: number, clubNumber: number): void {
    if (!Number.isInteger(teamId) || teamId <= 0) return;
    if (!Number.isInteger(clubNumber) || clubNumber <= 0) return;

    const existing = observed.get(teamId);
    if (existing) {
      existing.add(clubNumber);
    } else {
      observed.set(teamId, new Set([clubNumber]));
    }
  }

  for (const team of ownTeams) {
    record(team.teamId, team.clubNumber);
  }
  for (const entry of rankingEntries) {
    record(entry.teamId, entry.clubNumber);
  }

  const indexByTeamId = new Map<number, number>();
  const conflicts: ProviderClubIdConflict[] = [];

  for (const [teamId, clubIds] of observed) {
    if (clubIds.size === 1) {
      indexByTeamId.set(teamId, [...clubIds][0]);
    } else {
      conflicts.push({ teamId, observedClubIds: [...clubIds].sort((a, b) => a - b) });
    }
  }

  return { indexByTeamId, conflicts };
}

/**
 * Looks up the resolved `providerClubId` (SFV clubNumber) for a single
 * teamId from a pre-built index. Returns `null` when the teamId is not
 * covered by this run's ranking/team-list data (see module doc — a narrow,
 * documented gap, never a guess) or when the caller passes no index at all.
 */
export function resolveProviderClubId(
  index: ReadonlyMap<number, number> | undefined,
  teamId: number,
): number | null {
  return index?.get(teamId) ?? null;
}
