/**
 * scripts/media-logo-01d2-provider-logo-backfill-dry-run.ts
 *
 * MEDIA-LOGO-01D2 — provider logo backfill dry-run (STRICT: zero persistence).
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/media-logo-01d2-provider-logo-backfill-dry-run.ts
 *   npm run media-logo-01d2:dry-run
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  assertDryRunPerformsZeroPersistence,
  planProviderLogoBackfill,
  type LogoBackfillCandidatePlan,
  type ProviderLogoBackfillDryRunPlan,
} from "@/lib/assets/provider-logo-backfill-planner";

export const TENANT_KEY = "fc-allschwil";

function parseArgs(argv: readonly string[]): { json: boolean } {
  return { json: argv.includes("--json") };
}

function formatCandidateLine(plan: LogoBackfillCandidatePlan): string {
  const target = plan.providerIdentity.targetStorageKey ?? "n/a";
  const input = plan.normalization.sourceFormat ?? plan.selectionCategory;
  const output = plan.normalization.outputFingerprint
    ? `${plan.normalization.outputWidth}x${plan.normalization.outputHeight} sha256:${plan.normalization.outputFingerprint.slice(0, 12)}`
    : "n/a";
  return [
    plan.clubName,
    plan.providerIdentity.providerClubId?.toString() ?? "missing",
    input,
    output,
    target,
    plan.safetyClassification,
  ].join(" | ");
}

export function formatDryRunReport(plan: ProviderLogoBackfillDryRunPlan): string {
  const lines: string[] = [];
  const safety = assertDryRunPerformsZeroPersistence();

  lines.push("============================================================");
  lines.push("MEDIA-LOGO-01D2 — FINAL REPORT");
  lines.push("============================================================");
  lines.push("");
  lines.push("DRY RUN");
  lines.push(`ExternalClub rows evaluated: ${plan.summary.externalClubRowsEvaluated}`);
  lines.push(`Active candidates: ${plan.summary.activeCandidates}`);
  lines.push(`Manual protected: ${plan.summary.manualProtected}`);
  lines.push(`Already normalized (active selection): ${plan.summary.alreadyNormalized}`);
  lines.push(`Archived skipped: ${plan.summary.archivedSkipped}`);
  lines.push(`Missing source: ${plan.summary.missingSource}`);
  lines.push(`Provider mapping missing: ${plan.summary.providerMappingMissing}`);
  lines.push(`Provider ID ambiguous: ${plan.summary.providerIdAmbiguous}`);
  lines.push(`Target collisions: ${plan.summary.targetCollisions}`);
  lines.push("");
  lines.push("NORMALIZATION");
  lines.push(`Attempted: ${plan.summary.normalizationAttempted}`);
  lines.push(`Succeeded: ${plan.summary.normalizationSucceeded}`);
  lines.push(`Failed: ${plan.summary.normalizationFailed}`);
  lines.push(`Review required: ${plan.summary.reviewRequired}`);
  lines.push(`SAFE_TO_BACKFILL: ${plan.summary.safeToBackfill}`);
  lines.push("");
  lines.push("INPUT FORMATS");
  lines.push(`GIF: ${plan.summary.inputGif}`);
  lines.push(`JPEG: ${plan.summary.inputJpeg}`);
  lines.push(`PNG: ${plan.summary.inputPng}`);
  lines.push(`SVG: ${plan.summary.inputSvg}`);
  lines.push(`Other: ${plan.summary.inputOther}`);
  lines.push("");
  lines.push("BACKGROUND CLEANUP");
  lines.push(`Cleanup applied: ${plan.summary.cleanupApplied}`);
  lines.push(`No cleanup required: ${plan.summary.noCleanupRequired}`);
  lines.push(`Suspicious output: ${plan.summary.suspiciousOutput}`);
  lines.push(`Empty/invalid output: ${plan.summary.emptyOrInvalidOutput}`);
  lines.push("");
  lines.push("PROVIDER IDENTITY");
  lines.push(`Provider ID ready: ${plan.summary.providerIdReady}`);
  lines.push(`Mapping missing: ${plan.summary.providerMappingMissing}`);
  lines.push(`Ambiguous: ${plan.summary.providerIdAmbiguous}`);
  lines.push(`Deterministic targets generated: ${plan.summary.deterministicTargetsGenerated}`);
  lines.push("");
  lines.push("PLANNED MUTATION");
  lines.push(`Rows that WOULD change: ${plan.summary.rowsWouldChange}`);
  lines.push(`Rows protected: ${plan.summary.rowsProtected}`);
  lines.push(`Rows blocked: ${plan.summary.rowsBlocked}`);
  lines.push(`Blob uploads that WOULD occur: ${plan.summary.blobUploadsWouldOccur}`);
  lines.push(`Database updates that WOULD occur: ${plan.summary.databaseUpdatesWouldOccur}`);
  lines.push("");
  lines.push("REPRESENTATIVE PLAN");
  for (const entry of plan.representativePlans) {
    lines.push(formatCandidateLine(entry));
  }
  lines.push("");
  lines.push("ALREADY NORMALIZED");
  lines.push(`Count (active selection): ${plan.summary.alreadyNormalized}`);
  lines.push(`Safe for future Blob promotion: ${plan.summary.alreadyNormalizedSafeForPromotion}`);
  lines.push("");
  lines.push("D1B COUNT CHECK");
  for (const entry of plan.d1bComparisons) {
    lines.push(
      `${entry.category}: expected=${entry.expected} actual=${entry.actual} ${entry.matches ? "OK" : "MISMATCH"}`,
    );
  }
  lines.push(`Materially different from D1B: ${plan.d1bMateriallyDifferent ? "YES" : "NO"}`);
  lines.push("");
  lines.push("FC ALLSCHWIL VERIFICATION");
  lines.push(`Verified: ${plan.fcAllschwilVerification.verified ? "YES" : "NO"}`);
  for (const detail of plan.fcAllschwilVerification.details) {
    lines.push(`  - ${detail}`);
  }
  lines.push("");
  lines.push("COLLISIONS");
  if (plan.collisions.length === 0) {
    lines.push("none");
  } else {
    for (const collision of plan.collisions) {
      lines.push(
        `${collision.kind} provider=${collision.provider} providerClubId=${collision.providerClubId} clubs=${collision.clubNames.join(", ")}`,
      );
    }
  }
  lines.push("");
  lines.push("ACTUAL MUTATIONS");
  lines.push(`Database mutation: ${safety.databaseMutation}`);
  lines.push(`Blob write: ${safety.blobWrite}`);
  lines.push(`Provider request: ${safety.providerRequest}`);
  lines.push(`Provider sync: ${safety.providerSync}`);
  lines.push(`Migration: false`);
  lines.push(`Deployment: false`);
  lines.push("");
  lines.push(
    `RESULT: ${plan.d1bMateriallyDifferent || !plan.fcAllschwilVerification.verified ? "FAIL" : "PASS"}`,
  );

  return lines.join("\n");
}

export async function runProviderLogoBackfillDryRun(
  prisma: PrismaClient,
  tenantKey: string = TENANT_KEY,
): Promise<ProviderLogoBackfillDryRunPlan> {
  const tenant = await prisma.tenant.findFirst({
    where: { key: tenantKey, status: "ACTIVE" },
    select: { id: true, key: true },
  });

  if (!tenant) {
    throw new Error(`Active tenant not found for key ${tenantKey}`);
  }

  const rows = await prisma.externalClub.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      source: true,
      logoUrl: true,
      archivedAt: true,
      providerMappings: {
        select: {
          provider: true,
          providerClubId: true,
        },
      },
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
  });

  return planProviderLogoBackfill({
    tenantKey: tenant.key,
    tenantId: tenant.id,
    rows,
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("[media-logo-01d2] ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const plan = await runProviderLogoBackfillDryRun(prisma);

    if (args.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatDryRunReport(plan));
    }

    if (plan.d1bMateriallyDifferent || !plan.fcAllschwilVerification.verified) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("media-logo-01d2-provider-logo-backfill-dry-run.ts") ||
    process.argv[1].endsWith("media-logo-01d2-provider-logo-backfill-dry-run"));

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[media-logo-01d2] FATAL: ${message}`);
    process.exit(1);
  });
}
