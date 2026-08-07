/**
 * lib/integrations/sfv/sync/schedule-team-sync.ts
 *
 * TEAM-SFV-MAPPING-02 — Just-in-time team mapping healing during schedule sync.
 *
 * PROBLEM (proven from code — no live provider/DB access required)
 *   The automatic (cron-triggered) SFV sync (`runAutomaticSfvScheduleSync`,
 *   see auto-sync.ts) calls ONLY `syncSfvSchedule` — it never calls
 *   `syncSfvTeams`. `syncSfvTeams` is exclusively a manual admin action
 *   (POST /api/admin/integrations/sfv/teams/sync). `loadTeamMappings()` in
 *   schedule-persistence.ts only resolves participants whose
 *   TeamExternalMapping row already exists for the CURRENT externalSeasonId.
 *
 *   Result: whenever a tenant's configured SFV season advances (or a new
 *   club team appears mid-season) and nobody has manually re-run "Sync
 *   Teams" for that season, every schedule sync run — including every
 *   automatic cron run — persists matches with homeTeamId/awayTeamId left
 *   null for club-owned participants, surfacing as "Team nicht zugeordnet"
 *   in Matchcenter indefinitely. TEAM-SFV-MAPPING-01's season-carryover fix
 *   (`linkExistingTeamToNewSeason`) only runs inside `syncSfvTeams`, which
 *   the cron path never calls, so it never gets a chance to apply.
 *
 * FIX
 *   Schedule sync already fetches the authoritative club team list (via
 *   `fetchTeamList`) to build `clubOwnedSfvTeamIds` for participant
 *   classification. This module reuses that already-fetched data to
 *   opportunistically create/relink ONLY the TeamExternalMapping rows for
 *   SFV teamIds that are BOTH confirmed club-owned AND actually referenced
 *   by the current batch of schedule entries — using the exact same tested
 *   `processTeamDetail` / `loadCrossSeasonTeamIds` logic already proven in
 *   TEAM-SFV-MAPPING-01. SFV teamId remains the sole identity authority;
 *   nothing is ever inferred from team names.
 *
 *   Scope is deliberately narrow:
 *     - Never marks any mapping inactive — that remains the exclusive,
 *       deliberate responsibility of the manual "Sync Teams" action.
 *     - Never touches teams outside the current schedule batch.
 *     - Never creates a new canonical Team for a teamId that is not
 *       confirmed club-owned by the live provider team list.
 *     - Failures here must never block schedule/match persistence — the
 *       caller treats this as best-effort and continues exactly as before
 *       on any error (matches simply remain unresolved, same as today).
 */

import type { TeamDetail } from "../client";
import type { SfvTeamSyncContext } from "./types";
import {
  loadExistingMappings,
  loadCrossSeasonTeamIds,
  processTeamDetail,
} from "./team-persistence";

const PROVIDER = "SFV";

export type ScheduleTeamHealingResult = {
  candidates: number;
  created: number;
  relinked: number;
  updated: number;
  unchanged: number;
  failed: number;
};

function emptyResult(): ScheduleTeamHealingResult {
  return { candidates: 0, created: 0, relinked: 0, updated: 0, unchanged: 0, failed: 0 };
}

/**
 * Creates or relinks TeamExternalMapping rows (current season) for every
 * club-owned SFV teamId referenced by the current schedule batch.
 *
 * `processTeamDetail` (reused verbatim from team-persistence.ts) already
 * short-circuits to "unchanged" when a current-season mapping exists and
 * nothing changed, so calling this for an already-fully-mapped tenant is a
 * cheap no-op — the common case once a season is fully synced.
 */
export async function healMissingClubTeamMappings(
  tenantId: string,
  referencedSfvTeamIds: ReadonlySet<number>,
  clubOwnedSfvTeamIds: ReadonlySet<number>,
  clubTeamDetailsById: ReadonlyMap<number, TeamDetail>,
  context: SfvTeamSyncContext,
): Promise<ScheduleTeamHealingResult> {
  const candidateTeamIds = [...referencedSfvTeamIds].filter(
    (id) => clubOwnedSfvTeamIds.has(id) && clubTeamDetailsById.has(id),
  );

  if (candidateTeamIds.length === 0) return emptyResult();

  const result = emptyResult();
  result.candidates = candidateTeamIds.length;

  const existingMappings = await loadExistingMappings(tenantId, PROVIDER, context.seasonId);
  const crossSeasonTeamIds = await loadCrossSeasonTeamIds(tenantId, PROVIDER, context.seasonId);

  for (const sfvTeamId of candidateTeamIds) {
    const detail = clubTeamDetailsById.get(sfvTeamId);
    if (detail === undefined) continue;

    const outcome = await processTeamDetail(detail, context, existingMappings, crossSeasonTeamIds);

    switch (outcome.status) {
      case "created":
        result.created++;
        break;
      case "relinked":
        result.relinked++;
        break;
      case "updated":
        result.updated++;
        break;
      case "unchanged":
        result.unchanged++;
        break;
      case "failed":
        result.failed++;
        break;
    }
  }

  return result;
}
