/**
 * scripts/team-sfv-mapping-03-unresolved-fca-diagnosis.ts
 *
 * TEAM-SFV-MAPPING-03 — Read-only STAGE diagnosis for FC Allschwil matches
 * that Matchcenter still shows as "Team nicht zugeordnet" after PR #305
 * (TEAM-SFV-MAPPING-02).
 *
 * PURPOSE
 *   Traces every unresolved SFV-synced match, from the persisted
 *   MatchExternalMapping row back through TeamExternalMapping history, to a
 *   deterministic root-cause bucket — using the SFV provider teamId as the
 *   sole identity authority (never inferring anything from a display name).
 *
 *   Which side of a match is "FC Allschwil" is read from `Event.homeAway`,
 *   which was itself set at sync time by `classifyParticipant()`
 *   (schedule-mapper.ts) purely from provider-teamId club-ownership — this
 *   script never guesses the club side from a team name.
 *
 * MODE
 *   Read-only. There is no --execute mode in this script — it never writes
 *   to the database. It only reports.
 *
 * ROOT-CAUSE TAXONOMY (see `diagnoseSide` for the exact decision tree; this
 * maps directly onto the TEAM-SFV-MAPPING-03 "CHECK SPECIFICALLY" list):
 *   NO_MAPPING_ANY_SEASON                 — the provider teamId has never
 *     been persisted as a TeamExternalMapping row in any season. Candidate
 *     cause: the club-owned team-list fetch (GET /api/team/list) that
 *     schedule-sync healing (TEAM-SFV-MAPPING-02) relies on to classify
 *     "club-owned" never returned this teamId, so it is never a healing
 *     candidate — even though it clearly appears as a schedule participant.
 *   MAPPING_OTHER_SEASON_ONLY             — a mapping exists, but only for a
 *     season other than the tenant's current defaultSeasonId. Season
 *     carryover healing has not (yet) run for this specific teamId.
 *   MAPPING_CURRENT_SEASON_INACTIVE       — a current-season mapping row
 *     exists but is marked providerIsActive=false.
 *   MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH — a valid, active
 *     current-season mapping already resolves this teamId to a canonical
 *     Team, yet this specific match's own homeTeamId/awayTeamId column is
 *     still null — the match record itself was never re-persisted after the
 *     mapping became available (e.g. the match falls outside the rolling
 *     30-day-past/90-day-future schedule sync window, so it is never
 *     re-fetched/re-processed by `syncSfvSchedule`).
 *   AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS    — more than one canonical Team is
 *     mapped to the same provider teamId for the current season
 *     (split-identity — see TEAM-SFV-MAPPING-01).
 *
 * SCOPE
 *   - Tenant: fc-allschwil ONLY. Provider: SFV ONLY.
 *   - No writes. No inference from names. No live SFV API calls (this script
 *     is intentionally STAGE-DB-only so it produces identical evidence
 *     whether or not SFV provider credentials are reachable from the
 *     machine running it).
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/team-sfv-mapping-03-unresolved-fca-diagnosis.ts --inventory [--limit 25]
 */

import "dotenv/config";

import type { PrismaClient } from "@prisma/client";
import {
  TENANT_KEY,
  PROVIDER,
  detectEnvironment,
  maskUrl,
  createPrismaClient,
  isCliEntrypoint,
} from "./team-sfv-mapping-01-fca-reconciliation";

export { TENANT_KEY, PROVIDER };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MappingHistoryRow = {
  id: string;
  teamId: string;
  externalSeasonId: number;
  providerIsActive: boolean;
  lastSyncedAt: Date;
};

export type UnresolvedMatchRow = {
  eventId: string;
  startAt: Date;
  competitionLabel: string | null;
  externalMatchId: number;
  externalSeasonId: number;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeAway: string | null;
};

export type RootCauseCode =
  | "NO_MAPPING_ANY_SEASON"
  | "MAPPING_OTHER_SEASON_ONLY"
  | "MAPPING_CURRENT_SEASON_INACTIVE"
  | "MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH"
  | "AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS";

export type FcaSideResolution = {
  side: "HOME" | "AWAY";
  providerTeamId: number;
  providerTeamName: string | null;
  canonicalTeamId: string | null;
};

export type SideDiagnosis = {
  rootCause: RootCauseCode;
  canonicalTeamId: string | null;
  mappingSeasonsFound: number[];
  mappingActiveInCurrentSeason: boolean | null;
  reason: string;
};

export type DiagnosisRow = {
  eventId: string;
  matchDate: Date;
  competition: string | null;
  externalMatchId: number;
  externalSeasonId: number;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  fcaSide: "HOME" | "AWAY" | "UNKNOWN";
  fcaProviderTeamId: number | null;
  fcaProviderTeamName: string | null;
  mappingExists: boolean;
  mappingSeasonsFound: number[];
  mappingActiveInCurrentSeason: boolean | null;
  canonicalTeamId: string | null;
  canonicalTeamName: string | null;
  hasTeamSeasonForActiveSeason: boolean | null;
  matchcenterResolution: "RESOLVED" | "UNRESOLVED";
  rootCause: RootCauseCode | "UNKNOWN_HOMEAWAY";
  rootCauseReason: string;
};

// ---------------------------------------------------------------------------
// Pure logic (no DB access — unit-testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Resolves which side of a match is FC Allschwil purely from `Event.homeAway`
 * — a value written at sync time by `classifyParticipant()`
 * (schedule-mapper.ts) from confirmed provider-teamId club ownership. Never
 * infers the club side from a team display name.
 *
 * Returns null when homeAway is missing/unrecognized (legacy or corrupt
 * data) — the caller must not guess in that case either.
 */
export function resolveFcaSide(row: UnresolvedMatchRow): FcaSideResolution | null {
  const homeAway = row.homeAway?.trim().toUpperCase() ?? null;

  if (homeAway === "HOME" || homeAway === "H") {
    return {
      side: "HOME",
      providerTeamId: row.providerHomeTeamId,
      providerTeamName: row.providerHomeTeamName,
      canonicalTeamId: row.homeTeamId,
    };
  }

  if (homeAway === "AWAY" || homeAway === "A") {
    return {
      side: "AWAY",
      providerTeamId: row.providerAwayTeamId,
      providerTeamName: row.providerAwayTeamName,
      canonicalTeamId: row.awayTeamId,
    };
  }

  return null;
}

/**
 * Classifies WHY a single provider teamId's side of a match remains
 * unresolved, given every TeamExternalMapping row ever persisted for that
 * exact provider teamId (any season). Provider teamId is the sole identity
 * authority — this function never looks at team names.
 */
export function diagnoseSide(
  currentSeasonId: number,
  mappingHistory: readonly MappingHistoryRow[],
): SideDiagnosis {
  if (mappingHistory.length === 0) {
    return {
      rootCause: "NO_MAPPING_ANY_SEASON",
      canonicalTeamId: null,
      mappingSeasonsFound: [],
      mappingActiveInCurrentSeason: null,
      reason:
        "No TeamExternalMapping row exists for this provider teamId in any season — this team has never been imported by the manual team sync or by TEAM-SFV-MAPPING-02's schedule-sync healing.",
    };
  }

  const mappingSeasonsFound = [...new Set(mappingHistory.map((m) => m.externalSeasonId))].sort(
    (a, b) => a - b,
  );
  const currentSeasonRows = mappingHistory.filter((m) => m.externalSeasonId === currentSeasonId);

  if (currentSeasonRows.length === 0) {
    const mostRecent = [...mappingHistory].sort(
      (a, b) => b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime(),
    )[0];
    return {
      rootCause: "MAPPING_OTHER_SEASON_ONLY",
      canonicalTeamId: mostRecent.teamId,
      mappingSeasonsFound,
      mappingActiveInCurrentSeason: null,
      reason: `Mapping exists only for season(s) ${mappingSeasonsFound.join(", ")} — none for the current season ${currentSeasonId}. Season-carryover healing (TEAM-SFV-MAPPING-01/02) has not (yet) run for this specific provider teamId.`,
    };
  }

  const activeCurrentRows = currentSeasonRows.filter((m) => m.providerIsActive);

  if (activeCurrentRows.length === 0) {
    return {
      rootCause: "MAPPING_CURRENT_SEASON_INACTIVE",
      canonicalTeamId: currentSeasonRows[0].teamId,
      mappingSeasonsFound,
      mappingActiveInCurrentSeason: false,
      reason: `A TeamExternalMapping row exists for the current season ${currentSeasonId} but is marked providerIsActive=false, so loadTeamMappings() excludes it from participant resolution.`,
    };
  }

  const distinctTeamIds = [...new Set(activeCurrentRows.map((m) => m.teamId))];

  if (distinctTeamIds.length > 1) {
    return {
      rootCause: "AMBIGUOUS_MULTIPLE_CANONICAL_TEAMS",
      canonicalTeamId: null,
      mappingSeasonsFound,
      mappingActiveInCurrentSeason: true,
      reason: `Multiple distinct canonical Team ids (${distinctTeamIds.join(", ")}) are actively mapped to this single provider teamId for the current season — split identity (see TEAM-SFV-MAPPING-01).`,
    };
  }

  return {
    rootCause: "MAPPING_CURRENT_SEASON_ACTIVE_STALE_MATCH",
    canonicalTeamId: distinctTeamIds[0],
    mappingSeasonsFound,
    mappingActiveInCurrentSeason: true,
    reason: `A valid, active TeamExternalMapping already resolves this provider teamId to canonical Team ${distinctTeamIds[0]} for the current season, yet this specific MatchExternalMapping row's own teamId column is still null — the match record itself was never re-persisted after the mapping became available (e.g. it falls outside the rolling 30-day-past/90-day-future schedule sync window, so syncSfvSchedule never re-processes it).`,
  };
}

/**
 * Builds one complete diagnosis row from a raw unresolved match plus the
 * full mapping history for its (resolved-as-FCA) provider teamId, and
 * optional canonical Team / TeamSeason lookups.
 */
export function buildDiagnosisRow(
  match: UnresolvedMatchRow,
  currentSeasonId: number,
  mappingHistory: readonly MappingHistoryRow[],
  canonicalTeamName: string | null,
  hasTeamSeasonForActiveSeason: boolean | null,
): DiagnosisRow {
  const fca = resolveFcaSide(match);

  const base = {
    eventId: match.eventId,
    matchDate: match.startAt,
    competition: match.competitionLabel,
    externalMatchId: match.externalMatchId,
    externalSeasonId: match.externalSeasonId,
    providerHomeTeamId: match.providerHomeTeamId,
    providerAwayTeamId: match.providerAwayTeamId,
    matchcenterResolution: "UNRESOLVED" as const,
  };

  if (fca === null) {
    return {
      ...base,
      fcaSide: "UNKNOWN",
      fcaProviderTeamId: null,
      fcaProviderTeamName: null,
      mappingExists: false,
      mappingSeasonsFound: [],
      mappingActiveInCurrentSeason: null,
      canonicalTeamId: null,
      canonicalTeamName: null,
      hasTeamSeasonForActiveSeason: null,
      rootCause: "UNKNOWN_HOMEAWAY",
      rootCauseReason:
        "Event.homeAway is missing or not one of HOME/AWAY — cannot determine which side is FC Allschwil without inferring from a name. Inspect this row manually.",
    };
  }

  const diagnosis = diagnoseSide(currentSeasonId, mappingHistory);

  return {
    ...base,
    fcaSide: fca.side,
    fcaProviderTeamId: fca.providerTeamId,
    fcaProviderTeamName: fca.providerTeamName,
    mappingExists: mappingHistory.length > 0,
    mappingSeasonsFound: diagnosis.mappingSeasonsFound,
    mappingActiveInCurrentSeason: diagnosis.mappingActiveInCurrentSeason,
    canonicalTeamId: diagnosis.canonicalTeamId,
    canonicalTeamName,
    hasTeamSeasonForActiveSeason,
    rootCause: diagnosis.rootCause,
    rootCauseReason: diagnosis.reason,
  };
}

/** Aggregate rollup used to answer the TEAM-SFV-MAPPING-03 "CHECK SPECIFICALLY" list. */
export type DiagnosisSummary = {
  totalUnresolved: number;
  byRootCause: Record<string, number>;
  byFcaSide: Record<string, number>;
  distinctAffectedProviderTeamIds: number[];
};

export function summarizeDiagnosis(rows: readonly DiagnosisRow[]): DiagnosisSummary {
  const byRootCause: Record<string, number> = {};
  const byFcaSide: Record<string, number> = {};
  const teamIds = new Set<number>();

  for (const row of rows) {
    byRootCause[row.rootCause] = (byRootCause[row.rootCause] ?? 0) + 1;
    byFcaSide[row.fcaSide] = (byFcaSide[row.fcaSide] ?? 0) + 1;
    if (row.fcaProviderTeamId !== null) teamIds.add(row.fcaProviderTeamId);
  }

  return {
    totalUnresolved: rows.length,
    byRootCause,
    byFcaSide,
    distinctAffectedProviderTeamIds: [...teamIds].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Database-backed diagnosis
// ---------------------------------------------------------------------------

export async function runUnresolvedDiagnosis(
  prisma: PrismaClient,
  tenantKey: string = TENANT_KEY,
  limit = 25,
): Promise<{
  tenantExists: boolean;
  currentSeasonId: number | null;
  rows: DiagnosisRow[];
  summary: DiagnosisSummary;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { key: tenantKey }, select: { id: true } });

  if (!tenant) {
    return {
      tenantExists: false,
      currentSeasonId: null,
      rows: [],
      summary: summarizeDiagnosis([]),
    };
  }

  const sfvConfig = await prisma.tenantSfvConfig.findUnique({
    where: { tenantId: tenant.id },
    select: { defaultSeasonId: true },
  });
  const currentSeasonId = sfvConfig?.defaultSeasonId ?? null;

  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { startDate: "desc" },
  });

  const unresolvedMappings = await prisma.matchExternalMapping.findMany({
    where: {
      tenantId: tenant.id,
      provider: PROVIDER,
      OR: [{ homeTeamId: null }, { awayTeamId: null }],
    },
    select: {
      eventId: true,
      externalMatchId: true,
      externalSeasonId: true,
      providerHomeTeamId: true,
      providerAwayTeamId: true,
      providerHomeTeamName: true,
      providerAwayTeamName: true,
      homeTeamId: true,
      awayTeamId: true,
      event: { select: { startAt: true, competitionLabel: true, homeAway: true } },
    },
    orderBy: { event: { startAt: "asc" } },
    take: limit,
  });

  const matches: UnresolvedMatchRow[] = unresolvedMappings.map((m) => ({
    eventId: m.eventId,
    startAt: m.event.startAt,
    competitionLabel: m.event.competitionLabel,
    externalMatchId: m.externalMatchId,
    externalSeasonId: m.externalSeasonId,
    providerHomeTeamId: m.providerHomeTeamId,
    providerAwayTeamId: m.providerAwayTeamId,
    providerHomeTeamName: m.providerHomeTeamName,
    providerAwayTeamName: m.providerAwayTeamName,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeAway: m.event.homeAway,
  }));

  const rows: DiagnosisRow[] = [];

  for (const match of matches) {
    const fca = resolveFcaSide(match);

    if (fca === null || currentSeasonId === null) {
      rows.push(
        buildDiagnosisRow(match, currentSeasonId ?? -1, [], null, null),
      );
      continue;
    }

    const mappingHistory = await prisma.teamExternalMapping.findMany({
      where: { tenantId: tenant.id, provider: PROVIDER, externalTeamId: fca.providerTeamId },
      select: { id: true, teamId: true, externalSeasonId: true, providerIsActive: true, lastSyncedAt: true },
      orderBy: { lastSyncedAt: "desc" },
    });

    const diagnosis = diagnoseSide(currentSeasonId, mappingHistory);

    let canonicalTeamName: string | null = null;
    let hasTeamSeasonForActiveSeason: boolean | null = null;

    if (diagnosis.canonicalTeamId !== null) {
      const team = await prisma.team.findUnique({
        where: { id: diagnosis.canonicalTeamId },
        select: { name: true },
      });
      canonicalTeamName = team?.name ?? null;

      if (activeSeason) {
        const teamSeason = await prisma.teamSeason.findUnique({
          where: { teamId_seasonId: { teamId: diagnosis.canonicalTeamId, seasonId: activeSeason.id } },
          select: { id: true },
        });
        hasTeamSeasonForActiveSeason = teamSeason !== null;
      }
    }

    rows.push(buildDiagnosisRow(match, currentSeasonId, mappingHistory, canonicalTeamName, hasTeamSeasonForActiveSeason));
  }

  return { tenantExists: true, currentSeasonId, rows, summary: summarizeDiagnosis(rows) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { inventory: boolean; limit: number } {
  const args = argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 25;
  return {
    inventory: args.includes("--inventory"),
    limit: Number.isFinite(limit) && limit > 0 ? limit : 25,
  };
}

function formatRow(row: DiagnosisRow): string {
  return [
    `  ── ${row.matchDate.toISOString().slice(0, 10)} | matchId=${row.externalMatchId} | ${row.competition ?? "(no competition)"}`,
    `     providerHomeTeamId=${row.providerHomeTeamId}  providerAwayTeamId=${row.providerAwayTeamId}`,
    `     FCA side: ${row.fcaSide} (providerTeamId=${row.fcaProviderTeamId ?? "?"}, name="${row.fcaProviderTeamName ?? ""}")`,
    `     mapping exists?: ${row.mappingExists}   seasons found: [${row.mappingSeasonsFound.join(", ")}]   active in current season?: ${row.mappingActiveInCurrentSeason}`,
    `     canonical Team: ${row.canonicalTeamId ?? "(none)"} ${row.canonicalTeamName ? `"${row.canonicalTeamName}"` : ""}`,
    `     TeamSeason for active season?: ${row.hasTeamSeasonForActiveSeason}`,
    `     Matchcenter resolution: ${row.matchcenterResolution}`,
    `     ROOT CAUSE: ${row.rootCause}`,
    `       ${row.rootCauseReason}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.inventory) {
    console.error(
      "[team-sfv-mapping-03] ERROR: No mode specified. This script is read-only; use --inventory [--limit N].",
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[team-sfv-mapping-03] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error("[team-sfv-mapping-03] BLOCKED: DATABASE_URL appears to point to PRODUCTION.");
    process.exit(1);
  }

  console.log(`[team-sfv-mapping-03] Database: ${maskUrl(connectionString)}`);
  console.log(`[team-sfv-mapping-03] Detected environment: ${env}`);
  console.log("[team-sfv-mapping-03] Mode: READ-ONLY (no --execute mode exists in this script).");

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const result = await runUnresolvedDiagnosis(prisma, TENANT_KEY, opts.limit);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  TEAM-SFV-MAPPING-03 — Unresolved FCA Match Diagnosis (read-only)");
    console.log("═══════════════════════════════════════════════════════\n");

    if (!result.tenantExists) {
      console.log(`  Tenant "${TENANT_KEY}" NOT FOUND`);
      return;
    }

    console.log(`  Current SFV season (defaultSeasonId): ${result.currentSeasonId}`);
    console.log(`  Unresolved sample size (limit=${opts.limit}): ${result.rows.length}\n`);

    for (const row of result.rows) {
      console.log(formatRow(row));
      console.log("");
    }

    console.log("── SUMMARY ─────────────────────────────────────────────");
    console.log(`  Total unresolved in sample : ${result.summary.totalUnresolved}`);
    console.log(`  By root cause              :`, result.summary.byRootCause);
    console.log(`  By FCA side (home/away)    :`, result.summary.byFcaSide);
    console.log(
      `  Distinct affected provider teamIds: [${result.summary.distinctAffectedProviderTeamIds.join(", ")}]`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main() when invoked directly (not when imported by tests). See
// `isCliEntrypoint` in team-sfv-mapping-01-fca-reconciliation.ts for why this
// must not be a raw `new URL(...)` check (Windows/PowerShell compatibility).
if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    console.error("[team-sfv-mapping-03] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
