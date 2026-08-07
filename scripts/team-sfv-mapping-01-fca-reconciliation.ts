/**
 * scripts/team-sfv-mapping-01-fca-reconciliation.ts
 *
 * TEAM-SFV-MAPPING-01 — FC Allschwil SFV team-identity reconciliation.
 *
 * PROBLEM
 *   Before this slice, `lib/integrations/sfv/sync/team-persistence.ts`
 *   looked up existing TeamExternalMapping rows scoped to a single
 *   `externalSeasonId` only. Whenever the tenant's configured SFV season
 *   advanced (e.g. 2026 → 2027), every already-known SFV team appeared
 *   "new" and a brand-new canonical Team was created for it — producing
 *   several indistinguishable "FC Allschwil ..." Team rows that all trace
 *   back to the SAME real-world SFV teamId. See
 *   `lib/integrations/sfv/sync/team-persistence.ts` (`loadCrossSeasonTeamIds`)
 *   for the forward-looking fix that stops this from recurring.
 *
 *   This script cleans up mappings that were ALREADY split by that defect
 *   before the fix landed.
 *
 * SCOPE
 *   - Tenant: fc-allschwil ONLY.
 *   - Provider: SFV ONLY.
 *   - Never touches manual (non-SFV) teams, other tenants, TrainingCenter,
 *     Weekplanner, Dayplanner, Infoboard, Registrations, Roles/Permissions,
 *     or tournament ingestion.
 *
 * WHAT COUNTS AS "SAFE, CLEARLY DETERMINABLE" (per TEAM-SFV-MAPPING-01 rules)
 *   An externalTeamId is a SPLIT_IDENTITY when it is mapped (via
 *   TeamExternalMapping, provider=SFV) to more than one distinct canonical
 *   teamId. Provider IDs are authoritative — a single SFV teamId must
 *   resolve to a single canonical Team.
 *
 *   Within a SPLIT_IDENTITY group, the SURVIVOR is the Team with the
 *   earliest createdAt (the one created before the season-carryover defect
 *   started duplicating it).
 *
 *   The group is SAFE to auto-fix only when every non-survivor Team in the
 *   group is an "empty shell" — i.e. it has ZERO dependent rows elsewhere
 *   (TeamSeason, Event, EventImportRun, MatchExternalMapping as home or away
 *   team). Fixing a SAFE group re-points its TeamExternalMapping rows to
 *   the survivor's teamId and marks the empty-shell duplicate Team(s) as
 *   `isActive: false` (soft — never deleted, preserving history/audit).
 *
 *   Any group where a non-survivor Team already carries dependent data
 *   (rosters, events, competitions, …) is AMBIGUOUS and is only REPORTED —
 *   never auto-merged. Merging real roster/training/competition data across
 *   two canonical teams is a distinct, higher-risk operation intentionally
 *   out of scope for this slice.
 *
 * Modes:
 *   --inventory   Read-only: full inventory + SPLIT_IDENTITY classification.
 *   --dry-run     Read-only: exact fix plan for SAFE groups; zero DB writes.
 *   --execute     Live execution. Requires --confirm FIX-FCA-SFV-MAPPINGS
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-mapping-01-fca-reconciliation.ts --inventory
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-mapping-01-fca-reconciliation.ts --dry-run
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-mapping-01-fca-reconciliation.ts \
 *     --execute --confirm FIX-FCA-SFV-MAPPINGS
 *
 * Safety:
 *   - Refuses --execute against a DATABASE_URL that looks like production.
 *   - Only re-points TeamExternalMapping.teamId — never deletes a mapping
 *     row, never deletes a Team, never touches TeamSeason/Event/roster data.
 *   - Writes a pre-change JSON backup to .tmp/ (gitignored) before executing.
 *   - Runs inside a single transaction with hard postconditions; any failed
 *     postcondition rolls back the whole transaction.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TENANT_KEY = "fc-allschwil";
export const PROVIDER = "SFV";
export const EXECUTE_CONFIRMATION = "FIX-FCA-SFV-MAPPINGS";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MappingRow = {
  id: string;
  teamId: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date;
};

export type TeamDependentCounts = {
  teamSeasons: number;
  events: number;
  eventImportRuns: number;
  homeMatchMappings: number;
  awayMatchMappings: number;
};

export function hasDependentData(counts: TeamDependentCounts): boolean {
  return (
    counts.teamSeasons > 0 ||
    counts.events > 0 ||
    counts.eventImportRuns > 0 ||
    counts.homeMatchMappings > 0 ||
    counts.awayMatchMappings > 0
  );
}

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  dependentCounts: TeamDependentCounts;
};

export type SplitIdentityGroup = {
  externalTeamId: number;
  teamIds: string[];
  mappings: MappingRow[];
  teams: TeamRow[];
  survivorTeamId: string;
  classification: "SAFE" | "AMBIGUOUS";
  reason: string;
};

export type InventoryResult = {
  tenant: { exists: boolean; id?: string };
  totalMappings: number;
  distinctTeamsWithSfvMapping: number;
  splitIdentityGroups: SplitIdentityGroup[];
};

export type FixPlanEntry = {
  externalTeamId: number;
  survivorTeamId: string;
  mappingIdsToRepoint: string[];
  teamIdsToDeactivate: string[];
};

export type DryRunPlan = {
  safeFixes: FixPlanEntry[];
  ambiguousGroups: Array<{ externalTeamId: number; reason: string }>;
};

// ---------------------------------------------------------------------------
// Pure classification logic (no DB access — unit-testable in isolation)
// ---------------------------------------------------------------------------

/**
 * Groups mapping rows by externalTeamId and classifies each group with more
 * than one distinct teamId as a SPLIT_IDENTITY. Every classification decision
 * here is a pure function of its inputs — no database access.
 */
export function classifySplitIdentityGroups(
  mappings: MappingRow[],
  teams: Map<string, TeamRow>,
): SplitIdentityGroup[] {
  const byExternalTeamId = new Map<number, MappingRow[]>();
  for (const mapping of mappings) {
    const list = byExternalTeamId.get(mapping.externalTeamId) ?? [];
    list.push(mapping);
    byExternalTeamId.set(mapping.externalTeamId, list);
  }

  const groups: SplitIdentityGroup[] = [];

  for (const [externalTeamId, groupMappings] of byExternalTeamId.entries()) {
    const distinctTeamIds = [...new Set(groupMappings.map((m) => m.teamId))];
    if (distinctTeamIds.length <= 1) continue; // not a split — nothing to fix

    const groupTeams = distinctTeamIds
      .map((id) => teams.get(id))
      .filter((t): t is TeamRow => t !== undefined);

    // Deterministic survivor: earliest-created Team. Ties broken by teamId
    // (stable, arbitrary but deterministic) so re-runs are idempotent.
    const survivor = [...groupTeams].sort((a, b) => {
      const byDate = a.createdAt.getTime() - b.createdAt.getTime();
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    })[0];

    const nonSurvivors = groupTeams.filter((t) => t.id !== survivor.id);
    const ambiguousTeam = nonSurvivors.find((t) => hasDependentData(t.dependentCounts));

    groups.push({
      externalTeamId,
      teamIds: distinctTeamIds,
      mappings: groupMappings,
      teams: groupTeams,
      survivorTeamId: survivor.id,
      classification: ambiguousTeam ? "AMBIGUOUS" : "SAFE",
      reason: ambiguousTeam
        ? `Team ${ambiguousTeam.id} ("${ambiguousTeam.name}") has dependent data (teamSeasons=${ambiguousTeam.dependentCounts.teamSeasons}, events=${ambiguousTeam.dependentCounts.events}, eventImportRuns=${ambiguousTeam.dependentCounts.eventImportRuns}, homeMatchMappings=${ambiguousTeam.dependentCounts.homeMatchMappings}, awayMatchMappings=${ambiguousTeam.dependentCounts.awayMatchMappings}) — merging real team data is out of scope for this slice; manual review required.`
        : `All ${nonSurvivors.length} non-survivor team(s) are empty shells (no dependent data) — safe to consolidate onto ${survivor.id} ("${survivor.name}", created ${survivor.createdAt.toISOString()}).`,
    });
  }

  return groups.sort((a, b) => a.externalTeamId - b.externalTeamId);
}

export function buildFixPlan(groups: SplitIdentityGroup[]): DryRunPlan {
  const safeFixes: FixPlanEntry[] = [];
  const ambiguousGroups: Array<{ externalTeamId: number; reason: string }> = [];

  for (const group of groups) {
    if (group.classification === "AMBIGUOUS") {
      ambiguousGroups.push({ externalTeamId: group.externalTeamId, reason: group.reason });
      continue;
    }

    const mappingIdsToRepoint = group.mappings
      .filter((m) => m.teamId !== group.survivorTeamId)
      .map((m) => m.id);
    const teamIdsToDeactivate = group.teams
      .filter((t) => t.id !== group.survivorTeamId)
      .map((t) => t.id);

    safeFixes.push({
      externalTeamId: group.externalTeamId,
      survivorTeamId: group.survivorTeamId,
      mappingIdsToRepoint,
      teamIdsToDeactivate,
    });
  }

  return { safeFixes, ambiguousGroups };
}

// ---------------------------------------------------------------------------
// Environment helpers (shared conventions with stage-cleanup-01)
// ---------------------------------------------------------------------------

export function detectEnvironment(url: string | undefined): string {
  if (!url) return "UNKNOWN";
  const l = url.toLowerCase();
  if (l.includes("prod")) return "PROD";
  if (l.includes("stage")) return "STAGE";
  if (l.includes("localhost") || l.includes("127.0.0.1")) return "LOCAL";
  return "EXTERNAL";
}

export function maskUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username || "(no user)"}:***@${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

export function createPrismaClient(connectionString: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

/**
 * Determines whether this module was invoked directly as the CLI entrypoint
 * (e.g. `npx tsx team-sfv-mapping-01-fca-reconciliation.ts --inventory`), as
 * opposed to being imported by another module (e.g. the test suite).
 *
 * The previous check — `import.meta.url === new URL(process.argv[1], "file://").href`
 * — silently failed on Windows/PowerShell: `new URL(path, base)` does not
 * understand Windows path separators (`\`) or drive letters (`C:\...`), so
 * the constructed URL never matched `import.meta.url` and `main()` was
 * never invoked, even though `tsx` still exited 0 with no output.
 *
 * `pathToFileURL` is Node's purpose-built, platform-aware conversion for
 * exactly this comparison. `platform` defaults to the real `process.platform`
 * at call time but can be overridden, which makes both the Windows and the
 * POSIX branch deterministically unit-testable from a single host.
 */
export function isCliEntrypoint(
  argv1: string | undefined,
  moduleUrl: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!argv1) return false;
  try {
    return pathToFileURL(argv1, { windows: platform === "win32" }).href === moduleUrl;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Database-backed inventory
// ---------------------------------------------------------------------------

export async function runInventory(prisma: PrismaClient, tenantKey: string = TENANT_KEY): Promise<InventoryResult> {
  const tenant = await prisma.tenant.findUnique({ where: { key: tenantKey }, select: { id: true } });

  if (!tenant) {
    return { tenant: { exists: false }, totalMappings: 0, distinctTeamsWithSfvMapping: 0, splitIdentityGroups: [] };
  }

  const mappingRows = await prisma.teamExternalMapping.findMany({
    where: { tenantId: tenant.id, provider: PROVIDER },
    select: {
      id: true,
      teamId: true,
      externalTeamId: true,
      externalSeasonId: true,
      providerTeamName: true,
      providerIsActive: true,
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
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          teamSeasons: true,
          events: true,
          eventImportRuns: true,
          homeMatchMappings: true,
          awayMatchMappings: true,
        },
      },
    },
  });

  const teams = new Map<string, TeamRow>(
    teamRows.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        slug: t.slug,
        isActive: t.isActive,
        createdAt: t.createdAt,
        dependentCounts: {
          teamSeasons: t._count.teamSeasons,
          events: t._count.events,
          eventImportRuns: t._count.eventImportRuns,
          homeMatchMappings: t._count.homeMatchMappings,
          awayMatchMappings: t._count.awayMatchMappings,
        },
      },
    ]),
  );

  const splitIdentityGroups = classifySplitIdentityGroups(mappingRows, teams);

  return {
    tenant: { exists: true, id: tenant.id },
    totalMappings: mappingRows.length,
    distinctTeamsWithSfvMapping: distinctTeamIds.length,
    splitIdentityGroups,
  };
}

// ---------------------------------------------------------------------------
// Backup + execute
// ---------------------------------------------------------------------------

export function writeBackupToDisk(snapshot: unknown, outDir = ".tmp"): string {
  const dir = path.resolve(process.cwd(), outDir);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `team-sfv-mapping-01-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

export type ExecuteResult = {
  success: boolean;
  fixedGroups: number;
  mappingsRepointed: number;
  teamsDeactivated: number;
  skippedAmbiguousGroups: number;
  postconditions: Array<{ check: string; passed: boolean; detail: string }>;
};

export async function runExecute(prisma: PrismaClient, plan: DryRunPlan): Promise<ExecuteResult> {
  const result: ExecuteResult = {
    success: false,
    fixedGroups: 0,
    mappingsRepointed: 0,
    teamsDeactivated: 0,
    skippedAmbiguousGroups: plan.ambiguousGroups.length,
    postconditions: [],
  };

  await prisma.$transaction(async (tx) => {
    const before = await tx.teamExternalMapping.count({ where: { provider: PROVIDER } });

    for (const fix of plan.safeFixes) {
      if (fix.mappingIdsToRepoint.length > 0) {
        await tx.teamExternalMapping.updateMany({
          where: { id: { in: fix.mappingIdsToRepoint } },
          data: { teamId: fix.survivorTeamId },
        });
        result.mappingsRepointed += fix.mappingIdsToRepoint.length;
      }

      if (fix.teamIdsToDeactivate.length > 0) {
        await tx.team.updateMany({
          where: { id: { in: fix.teamIdsToDeactivate } },
          data: { isActive: false },
        });
        result.teamsDeactivated += fix.teamIdsToDeactivate.length;
      }

      result.fixedGroups++;
    }

    const after = await tx.teamExternalMapping.count({ where: { provider: PROVIDER } });
    result.postconditions.push({
      check: "No TeamExternalMapping row was created or deleted (only teamId re-pointed)",
      passed: before === after,
      detail: `before=${before} after=${after}`,
    });

    // Re-verify: every externalTeamId that was fixed now resolves to exactly
    // one distinct teamId (the survivor).
    for (const fix of plan.safeFixes) {
      const remaining = await tx.teamExternalMapping.findMany({
        where: { provider: PROVIDER, externalTeamId: fix.externalTeamId },
        select: { teamId: true },
      });
      const distinct = new Set(remaining.map((r) => r.teamId));
      result.postconditions.push({
        check: `externalTeamId ${fix.externalTeamId} resolves to a single canonical teamId`,
        passed: distinct.size === 1 && distinct.has(fix.survivorTeamId),
        detail: `distinctTeamIds=[${[...distinct].join(", ")}]`,
      });
    }

    const failed = result.postconditions.filter((p) => !p.passed);
    if (failed.length > 0) {
      throw new Error(
        `Postcondition failure — rolling back transaction:\n${failed.map((p) => `  FAILED: ${p.check} (${p.detail})`).join("\n")}`,
      );
    }
  });

  result.success = true;
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  inventory: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    inventory: has("--inventory"),
    dryRun: has("--dry-run"),
    execute: has("--execute"),
    confirm: get("--confirm"),
  };
}

function printInventory(inv: InventoryResult): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  TEAM-SFV-MAPPING-01 — Inventory Mode (read-only)");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!inv.tenant.exists) {
    console.log(`  Tenant "${TENANT_KEY}" NOT FOUND`);
    return;
  }

  console.log(`  Total SFV mapping rows      : ${inv.totalMappings}`);
  console.log(`  Distinct teams mapped       : ${inv.distinctTeamsWithSfvMapping}`);
  console.log(`  SPLIT_IDENTITY groups found : ${inv.splitIdentityGroups.length}`);

  for (const g of inv.splitIdentityGroups) {
    console.log(`\n  ── externalTeamId ${g.externalTeamId} [${g.classification}] ──`);
    console.log(`     teamIds: ${g.teamIds.join(", ")}`);
    console.log(`     survivor: ${g.survivorTeamId}`);
    console.log(`     reason: ${g.reason}`);
  }
  console.log("");
}

function printDryRunPlan(plan: DryRunPlan): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  TEAM-SFV-MAPPING-01 — Dry-Run Mode (zero DB writes)");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log(`  SAFE fixes      : ${plan.safeFixes.length}`);
  for (const f of plan.safeFixes) {
    console.log(
      `    externalTeamId ${f.externalTeamId}: repoint ${f.mappingIdsToRepoint.length} mapping(s) → ${f.survivorTeamId}; deactivate ${f.teamIdsToDeactivate.length} empty-shell team(s)`,
    );
  }

  console.log(`\n  AMBIGUOUS (report-only, no changes): ${plan.ambiguousGroups.length}`);
  for (const a of plan.ambiguousGroups) {
    console.log(`    externalTeamId ${a.externalTeamId}: ${a.reason}`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.inventory && !opts.dryRun && !opts.execute) {
    console.error("[team-sfv-mapping-01] ERROR: No mode specified. Use --inventory, --dry-run, or --execute.");
    process.exit(1);
  }

  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(
      `[team-sfv-mapping-01] REFUSED: --execute requires --confirm ${EXECUTE_CONFIRMATION}`,
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[team-sfv-mapping-01] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error("[team-sfv-mapping-01] BLOCKED: DATABASE_URL appears to point to PRODUCTION.");
    process.exit(1);
  }

  console.log(`[team-sfv-mapping-01] Database: ${maskUrl(connectionString)}`);
  console.log(`[team-sfv-mapping-01] Detected environment: ${env}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const inventory = await runInventory(prisma);

    if (opts.inventory) printInventory(inventory);

    if (opts.dryRun) {
      const plan = buildFixPlan(inventory.splitIdentityGroups);
      printDryRunPlan(plan);
    }

    if (opts.execute) {
      const plan = buildFixPlan(inventory.splitIdentityGroups);

      if (plan.safeFixes.length === 0) {
        console.log("[team-sfv-mapping-01] Nothing to fix — no SAFE split-identity groups found.");
        return;
      }

      const backupPath = writeBackupToDisk({ generatedAt: new Date().toISOString(), inventory, plan });
      console.log(`[team-sfv-mapping-01] Pre-change backup written to: ${backupPath}`);

      const result = await runExecute(prisma, plan);

      console.log("\n── EXECUTION RESULT ─────────────────────────────────────");
      console.log(`  Groups fixed         : ${result.fixedGroups}`);
      console.log(`  Mappings repointed   : ${result.mappingsRepointed}`);
      console.log(`  Teams deactivated    : ${result.teamsDeactivated}`);
      console.log(`  Ambiguous (skipped)  : ${result.skippedAmbiguousGroups}`);

      const allPassed = result.postconditions.every((p) => p.passed);
      if (!allPassed) {
        console.error("[team-sfv-mapping-01] CRITICAL: Postcondition failures — transaction rolled back.");
        process.exit(1);
      }
      console.log("\n[team-sfv-mapping-01] Reconciliation complete. Transaction committed successfully.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run main() when invoked directly (not when imported by tests). See
// `isCliEntrypoint` above for why this must not be a raw `new URL(...)` check.
if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    console.error("[team-sfv-mapping-01] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
