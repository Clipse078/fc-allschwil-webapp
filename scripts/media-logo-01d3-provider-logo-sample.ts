/**
 * scripts/media-logo-01d3-provider-logo-sample.ts
 *
 * MEDIA-LOGO-01D3 — non-mutating representative normalized logo previews.
 *
 * Reads approved source bytes from ExternalClub.logoUrl data URIs, normalizes
 * locally, and writes temporary PNG files for human visual review.
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npm run media-logo-01d3:sample
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  assertSampleGenerationPerformsZeroPersistence,
  DEFAULT_SAMPLE_CLUB_NAMES,
  generateProviderLogoSamplePreviews,
  type ProviderLogoSampleGenerationReport,
} from "@/lib/assets/provider-logo-backfill-sample";
import { runProviderLogoBackfillDryRun } from "./media-logo-01d2-provider-logo-backfill-dry-run";

export const DEFAULT_TENANT_KEY = "fc-allschwil";

export function parseSampleCliArgs(argv: readonly string[]): { json: boolean } {
  return { json: argv.includes("--json") };
}

export function formatSampleGenerationReport(report: ProviderLogoSampleGenerationReport): string {
  const safety = assertSampleGenerationPerformsZeroPersistence();
  const lines: string[] = [];

  lines.push("============================================================");
  lines.push("MEDIA-LOGO-01D3 — SAMPLE PREVIEW REPORT");
  lines.push("============================================================");
  lines.push("");
  lines.push(`Output directory: ${report.outputDirectory}`);
  lines.push(`Generated previews: ${report.generatedCount}`);
  lines.push(`Skipped: ${report.skippedCount}`);
  lines.push("");
  lines.push("DEFAULT REPRESENTATIVE CLUBS");
  for (const clubName of DEFAULT_SAMPLE_CLUB_NAMES) {
    lines.push(`- ${clubName}`);
  }
  lines.push("");
  lines.push("FILES");
  for (const entry of report.generated) {
    lines.push(
      [
        entry.clubName,
        entry.outputPath ?? "skipped",
        entry.sourceFormat ?? "unknown",
        entry.sourceWidth && entry.sourceHeight
          ? `${entry.sourceWidth}x${entry.sourceHeight}`
          : "n/a",
        entry.outputWidth && entry.outputHeight
          ? `${entry.outputWidth}x${entry.outputHeight}`
          : "n/a",
        entry.skippedReason ?? "ok",
      ].join(" | "),
    );
  }
  lines.push("");
  lines.push("ACTUAL MUTATIONS");
  lines.push(`Database mutation: ${safety.databaseMutation}`);
  lines.push(`Blob write: ${safety.blobWrite}`);
  lines.push(`Provider request: ${safety.providerRequest}`);
  lines.push(`Provider sync: ${safety.providerSync}`);

  return lines.join("\n");
}

export async function runProviderLogoSampleGeneration(
  prisma: PrismaClient,
  tenantKey: string = DEFAULT_TENANT_KEY,
): Promise<ProviderLogoSampleGenerationReport> {
  const plan = await runProviderLogoBackfillDryRun(prisma, tenantKey);
  return generateProviderLogoSamplePreviews({
    candidates: plan.candidates,
  });
}

async function main(): Promise<void> {
  const args = parseSampleCliArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("[media-logo-01d3-sample] ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const report = await runProviderLogoSampleGeneration(prisma);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatSampleGenerationReport(report));
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("media-logo-01d3-provider-logo-sample.ts") ||
    process.argv[1].endsWith("media-logo-01d3-provider-logo-sample"));

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[media-logo-01d3-sample] FATAL: ${message}`);
    process.exit(1);
  });
}
