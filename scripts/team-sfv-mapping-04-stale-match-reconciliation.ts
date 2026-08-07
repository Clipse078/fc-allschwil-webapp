/**
 * scripts/team-sfv-mapping-04-stale-match-reconciliation.ts
 *
 * TEAM-SFV-MAPPING-04 — Stale-match reconciliation CLI.
 *
 * PROBLEM (proven — see lib/integrations/sfv/sync/stale-match-reconciliation.ts
 * for the full trace, and TEAM-SFV-MAPPING-03 for the STAGE evidence):
 *   `syncSfvSchedule` only ever re-derives homeTeamId/awayTeamId for matches
 *   inside its rolling fetch window. A MatchExternalMapping row whose match
 *   date has already scrolled outside that window is never revisited by any
 *   sync run, even after its TeamExternalMapping becomes available. This
 *   script repairs already-persisted rows directly, independent of the fetch
 *   window and independent of the SFV API.
 *
 * SCOPE
 *   Tenant: fc-allschwil ONLY (default; overridable via --tenant-key).
 *   Provider: SFV ONLY. Season: the tenant's configured defaultSeasonId
 *   (default; overridable via --season).
 *
 * Modes:
 *   --dry-run     Read-only: full classification report; ZERO DB writes.
 *   --execute     Live execution. Requires --confirm FIX-SFV-STALE-MATCHES.
 *                 Applies ONLY the unambiguous "repairable" sides — never
 *                 touches ambiguous/conflict rows, never creates, merges,
 *                 deletes, or archives any Team, never mutates
 *                 TeamExternalMapping.
 *
 * There is no default mode — one of --dry-run or --execute must be given
 * explicitly. Importing this module (e.g. from a test) never runs `main()`
 * and never touches the database — see `isCliEntrypoint` below.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-mapping-04-stale-match-reconciliation.ts --dry-run
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-mapping-04-stale-match-reconciliation.ts \
 *     --execute --confirm FIX-SFV-STALE-MATCHES
 *
 * Safety:
 *   - Refuses --execute against a DATABASE_URL that looks like production.
 *   - Writes a pre-change JSON backup of the full report to .tmp/ (gitignored)
 *     before executing.
 *   - This task's instructions explicitly forbid running --execute against
 *     STAGE as part of TEAM-SFV-MAPPING-04 — this script was NOT invoked
 *     with --execute against STAGE_DB_URL/STAGE_DIRECT_URL during this task.
 */

import "dotenv/config";

import type { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import {
  TENANT_KEY as DEFAULT_TENANT_KEY,
  detectEnvironment,
  maskUrl,
  createPrismaClient,
  isCliEntrypoint,
} from "./team-sfv-mapping-01-fca-reconciliation";
import {
  STALE_MATCH_RECONCILIATION_PROVIDER,
  planStaleMatchReconciliation,
  applyRepairableEntries,
  type StaleMatchReconciliationReport,
} from "../lib/integrations/sfv/sync/stale-match-reconciliation";

export const EXECUTE_CONFIRMATION = "FIX-SFV-STALE-MATCHES";

// ---------------------------------------------------------------------------
// Season resolution
// ---------------------------------------------------------------------------

export async function resolveTenantAndSeason(
  prisma: PrismaClient,
  tenantKey: string,
  seasonOverride: number | undefined,
): Promise<
  | { ok: true; tenantId: string; seasonId: number }
  | { ok: false; reason: string }
> {
  const tenant = await prisma.tenant.findUnique({ where: { key: tenantKey }, select: { id: true } });
  if (!tenant) {
    return { ok: false, reason: `Tenant "${tenantKey}" not found.` };
  }

  if (seasonOverride !== undefined) {
    return { ok: true, tenantId: tenant.id, seasonId: seasonOverride };
  }

  const sfvConfig = await prisma.tenantSfvConfig.findUnique({
    where: { tenantId: tenant.id },
    select: { defaultSeasonId: true },
  });

  if (!sfvConfig) {
    return { ok: false, reason: `Tenant "${tenantKey}" has no TenantSfvConfig — pass --season explicitly.` };
  }

  return { ok: true, tenantId: tenant.id, seasonId: sfvConfig.defaultSeasonId };
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export function writeBackupToDisk(snapshot: unknown, outDir = ".tmp"): string {
  const dir = path.resolve(process.cwd(), outDir);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `team-sfv-mapping-04-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export function printReport(report: StaleMatchReconciliationReport): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  TEAM-SFV-MAPPING-04 — Stale-Match Reconciliation Report");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log(`  Tenant                 : ${report.tenantId}`);
  console.log(`  Provider               : ${report.provider}`);
  console.log(`  Season                 : ${report.seasonId}`);
  console.log(`  Total scanned          : ${report.totalScanned}`);
  console.log(`  Stale rows found       : ${report.staleRowsFound}`);
  console.log(`  Safely repairable      : ${report.repairableRows}`);
  console.log(`  Ambiguous (report only): ${report.ambiguousRows}`);
  console.log(`  Already correct        : ${report.alreadyCorrectRows}`);
  console.log(`  Affected externalTeamIds: [${report.affectedExternalTeamIds.join(", ")}]`);
  console.log(`  Affected matchIds       : [${report.affectedMatchIds.join(", ")}]\n`);

  const repairable = report.entries.filter((e) => e.classification === "repairable");
  const ambiguous = report.entries.filter((e) => e.classification === "ambiguous");

  if (repairable.length > 0) {
    console.log("  ── Proposed repairs (old → new) ──");
    for (const entry of repairable) {
      for (const side of [entry.home, entry.away]) {
        if (side.status === "repairable") {
          console.log(
            `    matchId=${entry.externalMatchId} [${side.side}] providerTeamId=${side.providerTeamId}: null → ${side.canonicalTeamId}`,
          );
        }
      }
    }
    console.log("");
  }

  if (ambiguous.length > 0) {
    console.log("  ── Ambiguous (never auto-changed — manual review required) ──");
    for (const entry of ambiguous) {
      for (const side of [entry.home, entry.away]) {
        if (side.status === "conflict") {
          console.log(
            `    matchId=${entry.externalMatchId} [${side.side}] providerTeamId=${side.providerTeamId}: existing=${side.existingTeamId} vs mapping=${side.candidateTeamId}`,
          );
        }
      }
    }
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
  tenantKey: string;
  season: number | undefined;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const seasonArg = get("--season");
  return {
    dryRun: has("--dry-run"),
    execute: has("--execute"),
    confirm: get("--confirm"),
    tenantKey: get("--tenant-key") ?? DEFAULT_TENANT_KEY,
    season: seasonArg !== undefined && Number.isFinite(Number(seasonArg)) ? Number(seasonArg) : undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.dryRun && !opts.execute) {
    console.error("[team-sfv-mapping-04] ERROR: No mode specified. Use --dry-run or --execute.");
    process.exit(1);
  }

  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(`[team-sfv-mapping-04] REFUSED: --execute requires --confirm ${EXECUTE_CONFIRMATION}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[team-sfv-mapping-04] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (env === "PROD") {
    console.error("[team-sfv-mapping-04] BLOCKED: DATABASE_URL appears to point to PRODUCTION.");
    process.exit(1);
  }

  if (opts.execute && env === "STAGE") {
    console.error(
      "[team-sfv-mapping-04] BLOCKED: --execute against a STAGE-looking DATABASE_URL is refused by this task's " +
        "explicit instructions (TEAM-SFV-MAPPING-04 must not mutate STAGE). Use --dry-run instead.",
    );
    process.exit(1);
  }

  console.log(`[team-sfv-mapping-04] Database: ${maskUrl(connectionString)}`);
  console.log(`[team-sfv-mapping-04] Detected environment: ${env}`);
  console.log(`[team-sfv-mapping-04] Mode: ${opts.execute ? "EXECUTE" : "DRY-RUN (zero writes)"}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const resolved = await resolveTenantAndSeason(prisma, opts.tenantKey, opts.season);
    if (!resolved.ok) {
      console.error(`[team-sfv-mapping-04] ERROR: ${resolved.reason}`);
      process.exit(1);
      return;
    }

    const report = await planStaleMatchReconciliation(
      resolved.tenantId,
      resolved.seasonId,
      STALE_MATCH_RECONCILIATION_PROVIDER,
    );

    printReport(report);

    if (opts.execute) {
      if (report.repairableRows === 0) {
        console.log("[team-sfv-mapping-04] Nothing to repair — no safely-repairable rows found.");
        return;
      }

      const backupPath = writeBackupToDisk({ generatedAt: new Date().toISOString(), report });
      console.log(`[team-sfv-mapping-04] Pre-change backup written to: ${backupPath}`);

      const { applied } = await applyRepairableEntries(report.entries);

      console.log("\n── EXECUTION RESULT ─────────────────────────────────────");
      console.log(`  Rows repaired  : ${new Set(applied.map((a) => a.mappingId)).size}`);
      console.log(`  Sides repaired : ${applied.length}`);
      console.log(`  Ambiguous (skipped, unchanged): ${report.ambiguousRows}`);
      console.log("\n[team-sfv-mapping-04] Reconciliation complete.");
    }
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
    console.error("[team-sfv-mapping-04] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
