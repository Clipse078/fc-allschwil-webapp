/**
 * scripts/media-logo-01d3-provider-logo-backfill.ts
 *
 * MEDIA-LOGO-01D3 — controlled provider logo backfill executor CLI.
 *
 * Default: dry-run / zero mutation.
 * Actual mutation requires ALL gates:
 *   --execute --tenant=fc-allschwil --expected-safe-count=N
 *   --expected-plan-fingerprint=<hash> --confirm=MEDIA-LOGO-01D3
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npm run media-logo-01d3:backfill
 *   DATABASE_URL=<stage-url> npm run media-logo-01d3:backfill -- --execute ...
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  computeBackfillPlanFingerprint,
  executeProviderLogoBackfillBatch,
  MEDIA_LOGO_01D3_CONFIRMATION,
  previewProviderLogoBackfillBatch,
  type ProviderLogoBackfillBatchResult,
  type ProviderLogoBackfillExecutionGates,
} from "@/lib/assets/provider-logo-backfill-executor";
import { uploadNormalizedProviderClubLogo } from "@/lib/assets/storage";
import { runProviderLogoBackfillDryRun } from "./media-logo-01d2-provider-logo-backfill-dry-run";

export const DEFAULT_TENANT_KEY = "fc-allschwil";

export type BackfillCliArgs = ProviderLogoBackfillExecutionGates & {
  json: boolean;
};

export function parseBackfillCliArgs(argv: readonly string[]): BackfillCliArgs {
  let tenantKey: string | null = null;
  let expectedSafeCount: number | null = null;
  let expectedPlanFingerprint: string | null = null;
  let confirm: string | null = null;

  for (const arg of argv) {
    if (arg === "--execute") {
      continue;
    }
    if (arg === "--json") {
      continue;
    }
    if (arg.startsWith("--tenant=")) {
      tenantKey = arg.slice("--tenant=".length).trim() || null;
      continue;
    }
    if (arg.startsWith("--expected-safe-count=")) {
      const parsed = Number.parseInt(arg.slice("--expected-safe-count=".length), 10);
      expectedSafeCount = Number.isFinite(parsed) ? parsed : null;
      continue;
    }
    if (arg.startsWith("--expected-plan-fingerprint=")) {
      expectedPlanFingerprint = arg.slice("--expected-plan-fingerprint=".length).trim() || null;
      continue;
    }
    if (arg.startsWith("--confirm=")) {
      confirm = arg.slice("--confirm=".length).trim() || null;
    }
  }

  return {
    execute: argv.includes("--execute"),
    tenantKey,
    expectedSafeCount,
    expectedPlanFingerprint,
    confirm,
    json: argv.includes("--json"),
  };
}

export function formatBackfillExecutionReport(
  result: ProviderLogoBackfillBatchResult,
  planFingerprint: string,
): string {
  const lines: string[] = [];

  lines.push("============================================================");
  lines.push("MEDIA-LOGO-01D3 — BACKFILL EXECUTOR REPORT");
  lines.push("============================================================");
  lines.push("");
  lines.push(`Mode: ${result.dryRun ? "DRY-RUN (zero mutation)" : "EXECUTE"}`);
  lines.push(`Plan fingerprint: ${planFingerprint}`);
  lines.push(`SAFE_TO_BACKFILL candidates: ${result.safeCandidateCount}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`Attempted: ${result.summary.attempted}`);
  lines.push(`Succeeded: ${result.summary.succeeded}`);
  lines.push(`Failed: ${result.summary.failed}`);
  lines.push(`Skipped: ${result.summary.skipped}`);
  lines.push(`Blocked: ${result.summary.blocked}`);
  lines.push(`Blob uploads: ${result.summary.blobUploads}`);
  lines.push(`Database updates: ${result.summary.databaseUpdates}`);
  lines.push(`Gate blocked: ${result.summary.gateBlocked ? "YES" : "NO"}`);
  if (result.summary.gateReason) {
    lines.push(`Gate reason: ${result.summary.gateReason}`);
  }
  lines.push("");
  lines.push("CANDIDATE RESULTS");
  for (const entry of result.results) {
    lines.push(
      [
        entry.clubName,
        entry.externalClubId,
        entry.outcome,
        entry.phase,
        entry.reason ?? "ok",
        entry.partialFailure ? "partial_failure" : "complete",
      ].join(" | "),
    );
  }
  lines.push("");
  lines.push("ACTUAL MUTATIONS THIS RUN");
  lines.push(`Blob writes: ${result.summary.blobUploads}`);
  lines.push(`Database updates: ${result.summary.databaseUpdates}`);
  lines.push(`Provider requests: false`);
  lines.push(`Provider sync: false`);

  return lines.join("\n");
}

export async function runProviderLogoBackfillExecutor(
  prisma: PrismaClient,
  args: BackfillCliArgs,
  tenantKey: string = DEFAULT_TENANT_KEY,
): Promise<{ result: ProviderLogoBackfillBatchResult; planFingerprint: string }> {
  const plan = await runProviderLogoBackfillDryRun(prisma, tenantKey);
  const planFingerprint = computeBackfillPlanFingerprint({
    tenantId: plan.tenantId,
    candidates: plan.candidates,
  });

  if (!args.execute) {
    const preview = await previewProviderLogoBackfillBatch({
      plan,
      gates: {
        tenantKey: args.tenantKey ?? tenantKey,
        expectedSafeCount: args.expectedSafeCount,
        expectedPlanFingerprint: args.expectedPlanFingerprint,
        confirm: args.confirm,
      },
    });

    return { result: preview, planFingerprint };
  }

  const result = await executeProviderLogoBackfillBatch({
    plan,
    gates: {
      execute: true,
      tenantKey: args.tenantKey,
      expectedSafeCount: args.expectedSafeCount,
      expectedPlanFingerprint: args.expectedPlanFingerprint,
      confirm: args.confirm,
    },
    dependencies: {
      normalizeProviderLogoBytes: (await import("@/lib/assets/provider-logo-normalization"))
        .normalizeProviderLogoBytes,
      uploadNormalizedProviderClubLogo,
      updateExternalClubLogoUrl: async ({ tenantId, externalClubId, logoUrl }) => {
        const updateResult = await prisma.externalClub.updateMany({
          where: {
            id: externalClubId,
            tenantId,
          },
          data: { logoUrl },
        });

        if (updateResult.count !== 1) {
          return {
            ok: false,
            error: `Expected exactly one ExternalClub update, got ${updateResult.count}`,
          };
        }

        return { ok: true };
      },
    },
  });

  return { result, planFingerprint };
}

async function main(): Promise<void> {
  const args = parseBackfillCliArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("[media-logo-01d3] ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const tenantKey = args.tenantKey ?? DEFAULT_TENANT_KEY;
    const { result, planFingerprint } = await runProviderLogoBackfillExecutor(
      prisma,
      args,
      tenantKey,
    );

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            confirmationRequired: MEDIA_LOGO_01D3_CONFIRMATION,
            ...result,
            planFingerprint,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(formatBackfillExecutionReport(result, planFingerprint));
      if (!args.execute) {
        console.log("");
        console.log(
          "DRY-RUN ONLY — rerun with --execute and all required gates to mutate.",
        );
        console.log(
          `Example fingerprint gate: --expected-plan-fingerprint=${planFingerprint}`,
        );
      }
    }

    if (
      args.execute &&
      (result.summary.gateBlocked ||
        result.summary.failed > 0 ||
        result.summary.blobUploads !== result.summary.databaseUpdates)
    ) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("media-logo-01d3-provider-logo-backfill.ts") ||
    process.argv[1].endsWith("media-logo-01d3-provider-logo-backfill"));

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[media-logo-01d3] FATAL: ${message}`);
    process.exit(1);
  });
}
