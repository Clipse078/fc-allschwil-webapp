/**
 * scripts/team-sfv-03-match-lifecycle-reconciliation.ts
 *
 * TEAM-SFV-03 — SFV match lifecycle/result reconciliation CLI.
 *
 * Aligns persisted Event.status with TEAM-SFV-02B lifecycle rules for
 * FC Allschwil SFV MATCH events in the configured season.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-03-match-lifecycle-reconciliation.ts --audit
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-03-match-lifecycle-reconciliation.ts --dry-run
 *   DATABASE_URL=<url> npx tsx scripts/team-sfv-03-match-lifecycle-reconciliation.ts \
 *     --execute --confirm FIX-SFV-MATCH-LIFECYCLE
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
  getCanonicalSeasonKeyFromSfvExternalSeasonId,
} from "../lib/integrations/sfv/season-bridge";
import {
  planMatchReconciliation,
  reconcileMatchLifecycle,
  createPrismaMatchReconciliationDatabase,
  type MatchReconciliationResult,
} from "../lib/sporting-data/match-reconciliation";

export const EXECUTE_CONFIRMATION = "FIX-SFV-MATCH-LIFECYCLE";

export async function resolveTenantSeasonScope(
  prisma: PrismaClient,
  tenantKey: string,
  seasonKeyOverride?: string,
  externalSeasonOverride?: number,
): Promise<
  | {
      ok: true;
      tenantId: string;
      tenantName: string;
      seasonId: string;
      seasonKey: string;
      externalSeasonId: number;
    }
  | { ok: false; reason: string }
> {
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantKey },
    select: {
      id: true,
      name: true,
      sfvConfig: { select: { defaultSeasonId: true } },
    },
  });

  if (!tenant) {
    return { ok: false, reason: `Tenant "${tenantKey}" was not found.` };
  }

  const externalSeasonId =
    externalSeasonOverride ?? tenant.sfvConfig?.defaultSeasonId ?? null;
  if (externalSeasonId == null) {
    return {
      ok: false,
      reason: `Tenant "${tenantKey}" has no SFV defaultSeasonId configured.`,
    };
  }

  const seasonKey =
    seasonKeyOverride ??
    getCanonicalSeasonKeyFromSfvExternalSeasonId(externalSeasonId);
  const season = await prisma.season.findUnique({
    where: { key: seasonKey },
    select: { id: true, key: true },
  });

  if (!season) {
    return {
      ok: false,
      reason: `Season with key "${seasonKey}" was not found.`,
    };
  }

  return {
    ok: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    seasonId: season.id,
    seasonKey: season.key,
    externalSeasonId,
  };
}

function printReport(result: MatchReconciliationResult): void {
  console.log(JSON.stringify({
    evaluated: result.evaluated,
    planned: result.planned.length,
    unsafe: result.unsafe.length,
    beforeCounts: result.beforeCounts,
    afterCounts: result.afterCounts,
    completedUpdates: result.completedUpdates,
    postponedUpdates: result.postponedUpdates,
    cancelledUpdates: result.cancelledUpdates,
    liveUpdates: result.liveUpdates,
    applied: result.applied,
    dryRun: result.dryRun,
  }, null, 2));
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const audit = argv.includes("--audit");
  const dryRun = argv.includes("--dry-run");
  const execute = argv.includes("--execute");

  if ([audit, dryRun, execute].filter(Boolean).length !== 1) {
    console.error("Specify exactly one of --audit, --dry-run, or --execute.");
    process.exit(1);
  }

  if (execute) {
    const confirmIndex = argv.indexOf("--confirm");
    const confirmation = confirmIndex >= 0 ? argv[confirmIndex + 1] : undefined;
    if (confirmation !== EXECUTE_CONFIRMATION) {
      console.error(
        `Execute requires --confirm ${EXECUTE_CONFIRMATION}`,
      );
      process.exit(1);
    }
  }

  const tenantKey =
    argv.find((arg, index) => argv[index - 1] === "--tenant-key") ??
    DEFAULT_TENANT_KEY;
  const seasonKeyOverride = argv.find(
    (arg, index) => argv[index - 1] === "--season-key",
  );
  const externalSeasonArg = argv.find(
    (arg, index) => argv[index - 1] === "--external-season",
  );
  const externalSeasonOverride = externalSeasonArg
    ? Number(externalSeasonArg)
    : undefined;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  console.log(`Environment: ${env}`);
  console.log(`Database: ${maskUrl(connectionString)}`);

  if (execute && env === "PROD") {
    console.error("Refusing --execute against production DATABASE_URL.");
    process.exit(1);
  }

  const { prisma, pool } = createPrismaClient(connectionString);
  const database = createPrismaMatchReconciliationDatabase(prisma);
  const scope = await resolveTenantSeasonScope(
    prisma,
    tenantKey,
    seasonKeyOverride,
    externalSeasonOverride,
  );

  if (!scope.ok) {
    console.error(scope.reason);
    process.exit(1);
  }

  console.log(`Tenant: ${scope.tenantName}`);
  console.log(`Season: ${scope.seasonKey}`);
  console.log(`SFV external season: ${scope.externalSeasonId}`);

  if (audit || dryRun) {
    const plan = await planMatchReconciliation(database, {
      tenantId: scope.tenantId,
      seasonId: scope.seasonId,
      externalSeasonId: scope.externalSeasonId,
    });
    printReport({
      ...plan,
      dryRun: true,
      applied: 0,
      completedUpdates: 0,
      postponedUpdates: 0,
      cancelledUpdates: 0,
      liveUpdates: 0,
    });
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const backupDir = path.join(process.cwd(), ".tmp");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `team-sfv-03-match-lifecycle-${Date.now()}.json`,
  );
  const dryPlan = await planMatchReconciliation(database, {
    tenantId: scope.tenantId,
    seasonId: scope.seasonId,
    externalSeasonId: scope.externalSeasonId,
  });
  fs.writeFileSync(backupPath, JSON.stringify(dryPlan, null, 2));
  console.log(`Backup written to ${backupPath}`);

  const result = await reconcileMatchLifecycle(database, {
    tenantId: scope.tenantId,
    seasonId: scope.seasonId,
    externalSeasonId: scope.externalSeasonId,
    dryRun: false,
  });
  printReport(result);
  await prisma.$disconnect();
  await pool.end();
}

if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
