/**
 * scripts/team-sfv-mapping-03-fca-identity-inventory.ts
 *
 * TEAM-SFV-MAPPING-03 — Read-only STAGE identity inventory for ALL current
 * FC Allschwil SFV team mappings, triggered by a Teams-UI data-quality
 * report: several canonical teams display simply as "FC Allschwil" under
 * Junioren/Aktive, and "FC Allschwil D1"/"D2" look duplicated next to
 * correctly named B1/B2/C2/D3 teams.
 *
 * CRITICAL RULE THIS SCRIPT ENFORCES
 *   Provider (SFV) teamId is the SOLE identity authority. Display name
 *   similarity/identity is NEVER used to infer or classify duplicates. Two
 *   canonical Teams that both render as "FC Allschwil" are only ever
 *   flagged as related if they share the exact same SFV externalTeamId;
 *   two canonical Teams both named "FC Allschwil D2" that map to two
 *   DIFFERENT externalTeamIds are correctly classified as distinct.
 *
 *   TEAM-SFV-MAPPING-01's finding of "13 mapping rows / 13 distinct mapped
 *   teams / 0 SPLIT_IDENTITY groups" only proves no single externalTeamId
 *   is split across multiple canonical Teams — it says nothing about
 *   whether those 13 canonical teams are individually well-formed
 *   (current-season mapping present/active, referenced by the current
 *   schedule, etc). This script re-derives split-identity independently
 *   (never assumes the prior finding still holds) AND adds the
 *   per-canonical-team quality checks TEAM-SFV-MAPPING-01 did not attempt.
 *
 * MODE: Read-only. There is no --execute mode in this script.
 *
 * CLASSIFICATION (see `classifyCanonicalTeamIdentity`):
 *   A. LEGITIMATE_DISTINCT_TEAM        — unique externalTeamId, not shared
 *      with any other canonical Team. A generic provider/display name
 *      ("FC Allschwil") is NOT evidence of duplication by itself.
 *   B. HISTORICAL_CROSS_SEASON_SAME_TEAM — the same externalTeamId appears
 *      across more than one season, always resolving to this one canonical
 *      Team — the healthy season-carryover case (TEAM-SFV-MAPPING-01).
 *   C. DUPLICATE_CANONICAL_IDENTITY    — this canonical Team's externalTeamId
 *      is ALSO mapped to at least one OTHER canonical Team (a genuine
 *      split-identity, provider-teamId authoritative). Never auto-merged
 *      here — reported only.
 *   D. UNRESOLVED_INSUFFICIENT_EVIDENCE — no TeamExternalMapping row at all,
 *      or no current-season mapping and no cross-season history to compare
 *      against. Not enough provider-identity evidence to classify safely;
 *      never mutate.
 *
 * MATCHCENTER CORRELATION
 *   For every canonical team, this also reports how many of its
 *   current-season MatchExternalMapping references (as home OR away,
 *   matched by providerHomeTeamId/providerAwayTeamId = this team's
 *   externalTeamId) are actually resolved (their own homeTeamId/awayTeamId
 *   column equals this canonical Team), still null (unresolved — the
 *   TEAM-SFV-MAPPING-03 "Team nicht zugeordnet" symptom), or point at a
 *   DIFFERENT canonical Team than the current mapping resolves to
 *   (mismatched — a stronger signal of a genuine identity problem, distinct
 *   from a merely stale/unrefreshed match row).
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/team-sfv-mapping-03-fca-identity-inventory.ts --inventory
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

export type TeamMappingFact = {
  externalTeamId: number;
  externalSeasonId: number;
  providerIsActive: boolean;
  providerTeamName: string | null;
  providerLeagueName: string | null;
  lastSyncedAt: Date;
};

export type TeamSeasonFact = {
  seasonKey: string;
  displayName: string;
};

export type CanonicalTeamFact = {
  id: string;
  name: string;
  slug: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  mappings: TeamMappingFact[];
  teamSeasons: TeamSeasonFact[];
  homeMatchCount: number;
  awayMatchCount: number;
};

export type IdentityClassification =
  | "LEGITIMATE_DISTINCT_TEAM"
  | "HISTORICAL_CROSS_SEASON_SAME_TEAM"
  | "DUPLICATE_CANONICAL_IDENTITY"
  | "UNRESOLVED_INSUFFICIENT_EVIDENCE";

export type MatchResolutionStats = {
  totalMatches: number;
  resolvedCount: number;
  unresolvedCount: number;
  mismatchedCount: number;
};

export type IdentityInventoryRow = {
  canonicalTeamId: string;
  teamName: string;
  teamSlug: string;
  category: string;
  teamIsActive: boolean;
  externalTeamIds: number[];
  currentSeasonMapping: TeamMappingFact | null;
  otherSeasonMappings: TeamMappingFact[];
  teamSeasons: TeamSeasonFact[];
  matchReferenceCount: number;
  appearsInCurrentSchedule: boolean;
  sharesExternalTeamIdWithOtherCanonicalTeam: boolean;
  otherCanonicalTeamIdsSharingExternalTeamId: string[];
  currentSeasonMatchStats: MatchResolutionStats | null;
  classification: IdentityClassification;
  reason: string;
  recommendedAction: string;
};

// ---------------------------------------------------------------------------
// Pure classification logic (no DB access — unit-testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Builds a map of externalTeamId -> set of canonical Team ids that have
 * EVER (any season) had a TeamExternalMapping row for it, across the whole
 * tenant+provider. Used purely to detect split identity (classification C)
 * — never to infer anything from a display name.
 */
export function buildExternalTeamIdOwnership(
  teams: readonly CanonicalTeamFact[],
): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  for (const team of teams) {
    for (const mapping of team.mappings) {
      const owners = map.get(mapping.externalTeamId) ?? new Set<string>();
      owners.add(team.id);
      map.set(mapping.externalTeamId, owners);
    }
  }
  return map;
}

/**
 * Classifies a single canonical Team's SFV identity quality, given the full
 * tenant-wide externalTeamId ownership map (for split-identity detection)
 * and the current SFV season id. Provider teamId is the sole authority —
 * `team.name` is read only for the output row, never for the decision tree.
 */
export function classifyCanonicalTeamIdentity(
  team: CanonicalTeamFact,
  externalTeamIdOwnership: ReadonlyMap<number, Set<string>>,
  currentSeasonId: number,
): IdentityInventoryRow {
  const externalTeamIds = [...new Set(team.mappings.map((m) => m.externalTeamId))].sort(
    (a, b) => a - b,
  );
  const currentSeasonMapping =
    team.mappings.find((m) => m.externalSeasonId === currentSeasonId) ?? null;
  const otherSeasonMappings = team.mappings.filter((m) => m.externalSeasonId !== currentSeasonId);
  const matchReferenceCount = team.homeMatchCount + team.awayMatchCount;

  const otherCanonicalTeamIdsSharingExternalTeamId = [
    ...new Set(
      externalTeamIds.flatMap((extId) => {
        const owners = externalTeamIdOwnership.get(extId);
        if (!owners) return [];
        return [...owners].filter((ownerId) => ownerId !== team.id);
      }),
    ),
  ];
  const sharesExternalTeamIdWithOtherCanonicalTeam =
    otherCanonicalTeamIdsSharingExternalTeamId.length > 0;

  const base = {
    canonicalTeamId: team.id,
    teamName: team.name,
    teamSlug: team.slug,
    category: team.category,
    teamIsActive: team.isActive,
    externalTeamIds,
    currentSeasonMapping,
    otherSeasonMappings,
    teamSeasons: team.teamSeasons,
    matchReferenceCount,
    appearsInCurrentSchedule: currentSeasonMapping !== null && matchReferenceCount > 0,
    sharesExternalTeamIdWithOtherCanonicalTeam,
    otherCanonicalTeamIdsSharingExternalTeamId,
    currentSeasonMatchStats: null as MatchResolutionStats | null,
  };

  if (team.mappings.length === 0) {
    return {
      ...base,
      classification: "UNRESOLVED_INSUFFICIENT_EVIDENCE",
      reason:
        "This canonical Team has zero TeamExternalMapping rows in any season — no SFV provider-teamId evidence exists to classify it at all.",
      recommendedAction:
        "MANUAL REVIEW REQUIRED — confirm via a fresh SFV team-list sync whether this is a legitimate club team awaiting its first mapping, or an orphaned/manually-created Team. Do not merge, delete, or archive based on its name.",
    };
  }

  if (sharesExternalTeamIdWithOtherCanonicalTeam) {
    return {
      ...base,
      classification: "DUPLICATE_CANONICAL_IDENTITY",
      reason: `At least one externalTeamId used by this Team (${externalTeamIds.join(", ")}) is ALSO mapped to a different canonical Team (${otherCanonicalTeamIdsSharingExternalTeamId.join(", ")}) — this is a genuine provider-teamId-authoritative split identity, independent of either Team's display name.`,
      recommendedAction:
        "MANUAL REVIEW REQUIRED — genuine split identity (same SFV teamId, multiple canonical Teams). Do not auto-merge; use the TEAM-SFV-MAPPING-01 SAFE/AMBIGUOUS dependent-data check before any consolidation.",
    };
  }

  if (currentSeasonMapping === null) {
    return {
      ...base,
      classification: "UNRESOLVED_INSUFFICIENT_EVIDENCE",
      reason: `This Team has mapping history (season(s): ${[...new Set(team.mappings.map((m) => m.externalSeasonId))].sort((a, b) => a - b).join(", ")}) but none for the current season ${currentSeasonId} — cannot confirm whether it is still an active club team without a fresh sync.`,
      recommendedAction:
        "MANUAL REVIEW REQUIRED — no current-season SFV mapping. Do not assume retirement or duplication; confirm against a live team-list sync before any action.",
    };
  }

  const distinctSeasonsForThisExternalId = new Set(
    team.mappings
      .filter((m) => m.externalTeamId === currentSeasonMapping.externalTeamId)
      .map((m) => m.externalSeasonId),
  );

  if (externalTeamIds.length === 1 && distinctSeasonsForThisExternalId.size > 1) {
    return {
      ...base,
      classification: "HISTORICAL_CROSS_SEASON_SAME_TEAM",
      reason: `The same externalTeamId ${currentSeasonMapping.externalTeamId} is mapped to this single canonical Team across ${distinctSeasonsForThisExternalId.size} seasons (${[...distinctSeasonsForThisExternalId].sort((a, b) => a - b).join(", ")}) — correctly consolidated season-carryover identity, not a duplicate.`,
      recommendedAction:
        "None required — correctly consolidated cross-season identity. A generic provider display name is a presentation concern only, never a merge candidate.",
    };
  }

  return {
    ...base,
    classification: "LEGITIMATE_DISTINCT_TEAM",
    reason: `Unique externalTeamId ${currentSeasonMapping.externalTeamId}, not shared with any other canonical Team. A generic or similar-looking display name ("${team.name}") is not, by itself, evidence of duplication.`,
    recommendedAction:
      "None required. If the generic display name is operationally confusing, consider a display-name-only update sourced from provider league/division metadata (providerLeagueName) — never a merge, and never based on name similarity alone.",
  };
}

/**
 * Computes how many of a provider teamId's current-season match references
 * (home OR away) are resolved to the expected canonical Team, still null
 * (unresolved), or resolved to some OTHER canonical Team (mismatched — a
 * stronger identity-quality signal than a merely stale match row).
 */
export function computeMatchResolutionStats(
  expectedCanonicalTeamId: string,
  matches: readonly { providerHomeTeamId: number; providerAwayTeamId: number; homeTeamId: string | null; awayTeamId: string | null }[],
  externalTeamId: number,
): MatchResolutionStats {
  let resolvedCount = 0;
  let unresolvedCount = 0;
  let mismatchedCount = 0;
  let totalMatches = 0;

  for (const match of matches) {
    const isHomeSide = match.providerHomeTeamId === externalTeamId;
    const isAwaySide = match.providerAwayTeamId === externalTeamId;
    if (!isHomeSide && !isAwaySide) continue;

    totalMatches++;
    const resolvedTeamId = isHomeSide ? match.homeTeamId : match.awayTeamId;

    if (resolvedTeamId === null) {
      unresolvedCount++;
    } else if (resolvedTeamId === expectedCanonicalTeamId) {
      resolvedCount++;
    } else {
      mismatchedCount++;
    }
  }

  return { totalMatches, resolvedCount, unresolvedCount, mismatchedCount };
}

export function summarizeMatchcenterResolution(stats: MatchResolutionStats | null): string {
  if (stats === null || stats.totalMatches === 0) return "NO CURRENT-SEASON MATCHES";
  if (stats.mismatchedCount > 0) {
    return `MISMATCHED (${stats.mismatchedCount}/${stats.totalMatches} resolve to a different Team)`;
  }
  if (stats.unresolvedCount > 0) {
    return `UNRESOLVED (${stats.unresolvedCount}/${stats.totalMatches} "Team nicht zugeordnet")`;
  }
  return `RESOLVED (${stats.resolvedCount}/${stats.totalMatches})`;
}

/** Aggregate rollup across the whole inventory. */
export type InventorySummary = {
  totalCanonicalTeams: number;
  byClassification: Record<string, number>;
  genericNameCandidates: string[];
};

export function summarizeInventory(rows: readonly IdentityInventoryRow[]): InventorySummary {
  const byClassification: Record<string, number> = {};
  const genericNameCandidates: string[] = [];

  for (const row of rows) {
    byClassification[row.classification] = (byClassification[row.classification] ?? 0) + 1;
    // Flagged purely for human review — never used as a classification input.
    if (row.teamName.trim().toLowerCase() === "fc allschwil") {
      genericNameCandidates.push(row.canonicalTeamId);
    }
  }

  return {
    totalCanonicalTeams: rows.length,
    byClassification,
    genericNameCandidates,
  };
}

// ---------------------------------------------------------------------------
// Database-backed inventory
// ---------------------------------------------------------------------------

export async function runIdentityInventory(
  prisma: PrismaClient,
  tenantKey: string = TENANT_KEY,
): Promise<{
  tenantExists: boolean;
  currentSeasonId: number | null;
  rows: IdentityInventoryRow[];
  summary: InventorySummary;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { key: tenantKey }, select: { id: true } });

  if (!tenant) {
    return { tenantExists: false, currentSeasonId: null, rows: [], summary: summarizeInventory([]) };
  }

  const sfvConfig = await prisma.tenantSfvConfig.findUnique({
    where: { tenantId: tenant.id },
    select: { defaultSeasonId: true },
  });
  const currentSeasonId = sfvConfig?.defaultSeasonId ?? null;

  const mappingRows = await prisma.teamExternalMapping.findMany({
    where: { tenantId: tenant.id, provider: PROVIDER },
    select: {
      teamId: true,
      externalTeamId: true,
      externalSeasonId: true,
      providerIsActive: true,
      providerTeamName: true,
      providerLeagueName: true,
      lastSyncedAt: true,
    },
  });

  const distinctTeamIds = [...new Set(mappingRows.map((m) => m.teamId))];

  const teamRows = await prisma.team.findMany({
    where: { id: { in: distinctTeamIds }, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      isActive: true,
      createdAt: true,
      teamSeasons: { select: { season: { select: { key: true } }, displayName: true } },
      _count: { select: { homeMatchMappings: true, awayMatchMappings: true } },
    },
  });

  const mappingsByTeamId = new Map<string, TeamMappingFact[]>();
  for (const m of mappingRows) {
    const list = mappingsByTeamId.get(m.teamId) ?? [];
    list.push({
      externalTeamId: m.externalTeamId,
      externalSeasonId: m.externalSeasonId,
      providerIsActive: m.providerIsActive,
      providerTeamName: m.providerTeamName,
      providerLeagueName: m.providerLeagueName,
      lastSyncedAt: m.lastSyncedAt,
    });
    mappingsByTeamId.set(m.teamId, list);
  }

  const teams: CanonicalTeamFact[] = teamRows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    category: t.category,
    isActive: t.isActive,
    createdAt: t.createdAt,
    mappings: mappingsByTeamId.get(t.id) ?? [],
    teamSeasons: t.teamSeasons.map((ts) => ({ seasonKey: ts.season.key, displayName: ts.displayName })),
    homeMatchCount: t._count.homeMatchMappings,
    awayMatchCount: t._count.awayMatchMappings,
  }));

  const ownership = buildExternalTeamIdOwnership(teams);

  const rows: IdentityInventoryRow[] = [];

  for (const team of teams) {
    const row = classifyCanonicalTeamIdentity(team, ownership, currentSeasonId ?? -1);

    if (currentSeasonId !== null && row.currentSeasonMapping !== null) {
      const matches = await prisma.matchExternalMapping.findMany({
        where: {
          tenantId: tenant.id,
          provider: PROVIDER,
          externalSeasonId: currentSeasonId,
          OR: [
            { providerHomeTeamId: row.currentSeasonMapping.externalTeamId },
            { providerAwayTeamId: row.currentSeasonMapping.externalTeamId },
          ],
        },
        select: { providerHomeTeamId: true, providerAwayTeamId: true, homeTeamId: true, awayTeamId: true },
      });

      row.currentSeasonMatchStats = computeMatchResolutionStats(
        team.id,
        matches,
        row.currentSeasonMapping.externalTeamId,
      );
    }

    rows.push(row);
  }

  return { tenantExists: true, currentSeasonId, rows, summary: summarizeInventory(rows) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function formatRow(row: IdentityInventoryRow): string {
  const lines = [
    `  ── Team ${row.canonicalTeamId} — "${row.teamName}" (${row.category}, slug=${row.teamSlug}, isActive=${row.teamIsActive})`,
    `     externalTeamId(s) ever used: [${row.externalTeamIds.join(", ")}]`,
    `     current-season mapping: ${row.currentSeasonMapping ? `externalTeamId=${row.currentSeasonMapping.externalTeamId} active=${row.currentSeasonMapping.providerIsActive} providerName="${row.currentSeasonMapping.providerTeamName ?? ""}" league="${row.currentSeasonMapping.providerLeagueName ?? ""}"` : "(none)"}`,
    `     other-season mappings: ${row.otherSeasonMappings.map((m) => `season=${m.externalSeasonId} extId=${m.externalTeamId}`).join("; ") || "(none)"}`,
    `     TeamSeason(s): ${row.teamSeasons.map((ts) => ts.displayName).join(", ") || "(none)"}`,
    `     match references (home+away, all seasons): ${row.matchReferenceCount}`,
    `     appears in current schedule?: ${row.appearsInCurrentSchedule}`,
    `     shares externalTeamId with another canonical Team?: ${row.sharesExternalTeamIdWithOtherCanonicalTeam}${row.sharesExternalTeamIdWithOtherCanonicalTeam ? ` [${row.otherCanonicalTeamIdsSharingExternalTeamId.join(", ")}]` : ""}`,
    `     Matchcenter resolution (current season): ${summarizeMatchcenterResolution(row.currentSeasonMatchStats)}`,
    `     CLASSIFICATION: ${row.classification}`,
    `       ${row.reason}`,
    `     RECOMMENDED ACTION: ${row.recommendedAction}`,
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes("--inventory")) {
    console.error(
      "[team-sfv-mapping-03-identity] ERROR: No mode specified. This script is read-only; use --inventory.",
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[team-sfv-mapping-03-identity] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error("[team-sfv-mapping-03-identity] BLOCKED: DATABASE_URL appears to point to PRODUCTION.");
    process.exit(1);
  }

  console.log(`[team-sfv-mapping-03-identity] Database: ${maskUrl(connectionString)}`);
  console.log(`[team-sfv-mapping-03-identity] Detected environment: ${env}`);
  console.log("[team-sfv-mapping-03-identity] Mode: READ-ONLY (no --execute mode exists in this script).");

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const result = await runIdentityInventory(prisma, TENANT_KEY);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  TEAM-SFV-MAPPING-03 — FCA Canonical Team Identity Inventory (read-only)");
    console.log("═══════════════════════════════════════════════════════\n");

    if (!result.tenantExists) {
      console.log(`  Tenant "${TENANT_KEY}" NOT FOUND`);
      return;
    }

    console.log(`  Current SFV season (defaultSeasonId): ${result.currentSeasonId}`);
    console.log(`  Canonical teams with at least one SFV mapping: ${result.rows.length}\n`);

    for (const row of result.rows) {
      console.log(formatRow(row));
      console.log("");
    }

    console.log("── SUMMARY ─────────────────────────────────────────────");
    console.log(`  Total canonical teams : ${result.summary.totalCanonicalTeams}`);
    console.log(`  By classification     :`, result.summary.byClassification);
    console.log(
      `  Teams displayed exactly as "FC Allschwil" (name flagged for human review only — never auto-classified as duplicates): [${result.summary.genericNameCandidates.join(", ")}]`,
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
    console.error("[team-sfv-mapping-03-identity] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
