/**
 * lib/integrations/sfv/sync/stale-match-reconciliation.ts
 *
 * TEAM-SFV-MAPPING-04 — Safe, deterministic repair of stale
 * MatchExternalMapping.homeTeamId / awayTeamId references.
 *
 * ROOT CAUSE (see PART 1 of the TEAM-SFV-MAPPING-04 report for the full
 * trace; summarized here for context):
 *   `syncSfvSchedule` (schedule.ts) fetches provider schedule entries within
 *   a rolling date window (SCHEDULE_WINDOW_PAST_DAYS / SCHEDULE_WINDOW_FUTURE_DAYS,
 *   see schedule-window.ts) and only ever calls `processScheduleEntry`
 *   (schedule-persistence.ts) — the sole code path that re-derives and
 *   persists `homeTeamId`/`awayTeamId` — for entries inside that window.
 *   `loadExistingMatchMappings` loads EVERY MatchExternalMapping row for the
 *   tenant/provider/season, but rows whose provider match date has scrolled
 *   outside the window are simply absent from `providerEntries` and are
 *   therefore never revisited, no matter how many times sync runs. If the
 *   canonical `TeamExternalMapping` for a participant only became available
 *   (via a manual "Sync Teams" run or the TEAM-SFV-MAPPING-02 schedule-sync
 *   healing) AFTER that specific match had already scrolled out of the
 *   window, `homeTeamId`/`awayTeamId` is stuck at whatever value was
 *   resolvable at the match's last in-window sync — permanently null even
 *   though a valid, active, current-season mapping now exists.
 *
 * FIX
 *   This module reconciles already-persisted MatchExternalMapping rows
 *   directly against the authoritative TeamExternalMapping table —
 *   completely decoupled from the schedule-fetch date window. It is:
 *     - tenant scoped, provider scoped, season scoped (every lookup uses the
 *       match's own tenantId/provider/externalSeasonId — the exact scoping
 *       TeamExternalMapping's unique constraint already enforces).
 *     - externalTeamId authoritative — never derives anything from a name.
 *     - conservative: only ever fills a NULL homeTeamId/awayTeamId. A
 *       non-null value is never overwritten; if it disagrees with what the
 *       current mapping would resolve to, the row is reported as a conflict
 *       ("ambiguous") instead of being silently changed.
 *     - idempotent: re-running finds nothing left to do once a row has been
 *       repaired (its side is now "already_correct").
 *     - never creates, merges, deletes, or archives a Team; never mutates
 *       TeamExternalMapping.
 *
 * Two independent capabilities are exposed:
 *   1. `planStaleMatchReconciliation` — read-only. Zero writes. Used by the
 *      dry-run CLI (scripts/team-sfv-mapping-04-stale-match-reconciliation.ts)
 *      and by the best-effort self-heal step wired into `syncSfvSchedule`
 *      (see schedule.ts) to decide whether there is anything to repair.
 *   2. `executeStaleMatchReconciliation` / `applyRepairableEntries` — writes
 *      ONLY the unambiguous "repairable" sides of the plan. Never invoked as
 *      a side effect of importing this module — always an explicit call.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { loadTeamMappings } from "./schedule-persistence";

export const STALE_MATCH_RECONCILIATION_PROVIDER = "SFV";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MatchSide = "home" | "away";

/** Minimal shape of a MatchExternalMapping row needed for reconciliation. */
export type StaleMatchCandidateRow = {
  id: string;
  eventId: string;
  externalMatchId: number;
  externalSeasonId: number;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

/**
 * Per-side classification. `teamMappings` passed to every classifier is
 * already scoped to tenantId + provider + externalSeasonId + providerIsActive
 * (see `loadTeamMappings` in schedule-persistence.ts), so a lookup hit here
 * already satisfies "tenant scoped, provider scoped, season scoped, active,
 * exactly one" by construction — the DB's
 * `@@unique([tenantId, provider, externalTeamId, externalSeasonId])`
 * guarantees at most one row can ever match.
 */
export type SideReconciliationOutcome =
  | {
      status: "repairable";
      side: MatchSide;
      providerTeamId: number;
      canonicalTeamId: string;
    }
  | {
      status: "already_correct";
      side: MatchSide;
      providerTeamId: number;
      canonicalTeamId: string;
    }
  | {
      /** Non-null existing value disagrees with what the mapping resolves to.
       * Never auto-changed — reported so an admin can investigate. */
      status: "conflict";
      side: MatchSide;
      providerTeamId: number;
      existingTeamId: string;
      candidateTeamId: string;
    }
  | {
      /** No active current-season TeamExternalMapping for this providerTeamId
       * (e.g. a genuine external opponent, or the mapping simply doesn't
       * exist/isn't active yet). Left untouched — not an error. */
      status: "unmapped";
      side: MatchSide;
      providerTeamId: number;
    };

export type MatchReconciliationEntry = {
  mappingId: string;
  eventId: string;
  externalMatchId: number;
  externalSeasonId: number;
  home: SideReconciliationOutcome;
  away: SideReconciliationOutcome;
  /**
   * "ambiguous" takes priority over "repairable": a row is never partially
   * auto-repaired on one side while silently leaving a real conflict
   * unreported on the other.
   */
  classification: "repairable" | "ambiguous" | "already_correct";
};

export type StaleMatchReconciliationReport = {
  tenantId: string;
  provider: string;
  seasonId: number;
  totalScanned: number;
  /** Rows with at least one null homeTeamId/awayTeamId at scan time. */
  staleRowsFound: number;
  repairableRows: number;
  ambiguousRows: number;
  alreadyCorrectRows: number;
  affectedExternalTeamIds: number[];
  affectedMatchIds: number[];
  entries: MatchReconciliationEntry[];
};

export type AppliedSideChange = {
  mappingId: string;
  eventId: string;
  externalMatchId: number;
  side: MatchSide;
  providerTeamId: number;
  previousTeamId: null;
  newTeamId: string;
};

export type StaleMatchReconciliationExecutionResult = {
  tenantId: string;
  provider: string;
  seasonId: number;
  rowsScanned: number;
  rowsRepaired: number;
  sidesRepaired: number;
  applied: AppliedSideChange[];
  skippedAmbiguousRows: number;
};

// ── Pure classification (no DB access — unit-testable in isolation) ───────────

function reconcileSide(
  side: MatchSide,
  providerTeamId: number,
  existingTeamId: string | null,
  teamMappings: ReadonlyMap<number, string>,
): SideReconciliationOutcome {
  const candidateTeamId = teamMappings.get(providerTeamId) ?? null;

  if (existingTeamId !== null) {
    if (candidateTeamId !== null && candidateTeamId !== existingTeamId) {
      return { status: "conflict", side, providerTeamId, existingTeamId, candidateTeamId };
    }
    return { status: "already_correct", side, providerTeamId, canonicalTeamId: existingTeamId };
  }

  if (candidateTeamId !== null) {
    return { status: "repairable", side, providerTeamId, canonicalTeamId: candidateTeamId };
  }

  return { status: "unmapped", side, providerTeamId };
}

/**
 * Classifies a single MatchExternalMapping row against the current,
 * already-loaded TeamExternalMapping map. Pure — no I/O.
 */
export function buildMatchReconciliationEntry(
  row: StaleMatchCandidateRow,
  teamMappings: ReadonlyMap<number, string>,
): MatchReconciliationEntry {
  const home = reconcileSide("home", row.providerHomeTeamId, row.homeTeamId, teamMappings);
  const away = reconcileSide("away", row.providerAwayTeamId, row.awayTeamId, teamMappings);

  const hasConflict = home.status === "conflict" || away.status === "conflict";
  const hasRepair = home.status === "repairable" || away.status === "repairable";

  const classification: MatchReconciliationEntry["classification"] = hasConflict
    ? "ambiguous"
    : hasRepair
      ? "repairable"
      : "already_correct";

  return {
    mappingId: row.id,
    eventId: row.eventId,
    externalMatchId: row.externalMatchId,
    externalSeasonId: row.externalSeasonId,
    home,
    away,
    classification,
  };
}

/**
 * Builds the full, deterministic dry-run report for a batch of candidate
 * rows. Pure — no I/O. Zero side effects, regardless of `classification`.
 */
export function buildStaleMatchReconciliationReport(
  tenantId: string,
  provider: string,
  seasonId: number,
  rows: readonly StaleMatchCandidateRow[],
  teamMappings: ReadonlyMap<number, string>,
): StaleMatchReconciliationReport {
  const entries = rows.map((row) => buildMatchReconciliationEntry(row, teamMappings));

  const staleRowsFound = rows.filter((r) => r.homeTeamId === null || r.awayTeamId === null).length;
  const repairable = entries.filter((e) => e.classification === "repairable");
  const ambiguous = entries.filter((e) => e.classification === "ambiguous");
  const alreadyCorrect = entries.filter((e) => e.classification === "already_correct");

  const affectedExternalTeamIds = new Set<number>();
  const affectedMatchIds = new Set<number>();
  for (const entry of [...repairable, ...ambiguous]) {
    affectedMatchIds.add(entry.externalMatchId);
    for (const side of [entry.home, entry.away]) {
      if (side.status === "repairable" || side.status === "conflict") {
        affectedExternalTeamIds.add(side.providerTeamId);
      }
    }
  }

  return {
    tenantId,
    provider,
    seasonId,
    totalScanned: rows.length,
    staleRowsFound,
    repairableRows: repairable.length,
    ambiguousRows: ambiguous.length,
    alreadyCorrectRows: alreadyCorrect.length,
    affectedExternalTeamIds: [...affectedExternalTeamIds].sort((a, b) => a - b),
    affectedMatchIds: [...affectedMatchIds].sort((a, b) => a - b),
    entries,
  };
}

// ── DB read ────────────────────────────────────────────────────────────────────

/**
 * Loads every MatchExternalMapping row for tenant + provider + season —
 * NOT filtered by date window, and NOT pre-filtered to null sides only
 * (classification itself determines what is stale/repairable/ambiguous/
 * already-correct). Read-only.
 */
export async function loadStaleMatchCandidates(
  tenantId: string,
  provider: string,
  seasonId: number,
): Promise<StaleMatchCandidateRow[]> {
  return prisma.matchExternalMapping.findMany({
    where: { tenantId, provider, externalSeasonId: seasonId },
    select: {
      id: true,
      eventId: true,
      externalMatchId: true,
      externalSeasonId: true,
      providerHomeTeamId: true,
      providerAwayTeamId: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
}

// ── Dry-run orchestrator (zero writes) ─────────────────────────────────────────

/**
 * Read-only: loads candidate matches + active current-season team mappings
 * and returns the full classification report. Performs ZERO database
 * writes under any circumstances.
 */
export async function planStaleMatchReconciliation(
  tenantId: string,
  seasonId: number,
  provider: string = STALE_MATCH_RECONCILIATION_PROVIDER,
): Promise<StaleMatchReconciliationReport> {
  const [rows, teamMappings] = await Promise.all([
    loadStaleMatchCandidates(tenantId, provider, seasonId),
    loadTeamMappings(tenantId, provider, seasonId),
  ]);

  return buildStaleMatchReconciliationReport(tenantId, provider, seasonId, rows, teamMappings);
}

// ── Execute (writes ONLY the "repairable" sides of the plan) ──────────────────

/**
 * Applies only the unambiguous "repairable" side(s) of every entry whose
 * `classification === "repairable"`. Never touches "ambiguous" or
 * "already_correct" rows. Never touches Team or TeamExternalMapping.
 *
 * Each write is individually guarded by re-asserting `homeTeamId: null` (or
 * `awayTeamId: null`) in the WHERE clause — the same null-check that
 * produced the classification is re-verified at write time, so a
 * concurrent write racing between the read and this update can never
 * clobber a value that became non-null in the interim. This also makes
 * repeated execution safe and idempotent: once a row is repaired, its next
 * classification is "already_correct" and it is no longer a candidate.
 */
export async function applyRepairableEntries(
  entries: readonly MatchReconciliationEntry[],
): Promise<{ applied: AppliedSideChange[] }> {
  const applied: AppliedSideChange[] = [];

  for (const entry of entries) {
    if (entry.classification !== "repairable") continue;

    const data: { homeTeamId?: string; awayTeamId?: string } = {};
    if (entry.home.status === "repairable") data.homeTeamId = entry.home.canonicalTeamId;
    if (entry.away.status === "repairable") data.awayTeamId = entry.away.canonicalTeamId;

    if (Object.keys(data).length === 0) continue;

    const where: Prisma.MatchExternalMappingWhereInput = {
      id: entry.mappingId,
      ...(data.homeTeamId !== undefined ? { homeTeamId: null } : {}),
      ...(data.awayTeamId !== undefined ? { awayTeamId: null } : {}),
    };

    const result = await prisma.matchExternalMapping.updateMany({ where, data });

    if (result.count > 0) {
      if (data.homeTeamId !== undefined) {
        applied.push({
          mappingId: entry.mappingId,
          eventId: entry.eventId,
          externalMatchId: entry.externalMatchId,
          side: "home",
          providerTeamId: entry.home.providerTeamId,
          previousTeamId: null,
          newTeamId: data.homeTeamId,
        });
      }
      if (data.awayTeamId !== undefined) {
        applied.push({
          mappingId: entry.mappingId,
          eventId: entry.eventId,
          externalMatchId: entry.externalMatchId,
          side: "away",
          providerTeamId: entry.away.providerTeamId,
          previousTeamId: null,
          newTeamId: data.awayTeamId,
        });
      }
    }
  }

  return { applied };
}

/**
 * Explicit execute entrypoint: plans, then applies only the repairable
 * subset. Requires an explicit call — never invoked merely by importing
 * this module (see `applyRepairableEntries` for the write-safety guarantees).
 */
export async function executeStaleMatchReconciliation(
  tenantId: string,
  seasonId: number,
  provider: string = STALE_MATCH_RECONCILIATION_PROVIDER,
): Promise<StaleMatchReconciliationExecutionResult> {
  const report = await planStaleMatchReconciliation(tenantId, seasonId, provider);
  const { applied } = await applyRepairableEntries(report.entries);

  return {
    tenantId,
    provider,
    seasonId,
    rowsScanned: report.totalScanned,
    rowsRepaired: new Set(applied.map((a) => a.mappingId)).size,
    sidesRepaired: applied.length,
    applied,
    skippedAmbiguousRows: report.ambiguousRows,
  };
}
