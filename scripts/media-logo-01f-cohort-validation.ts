/**
 * scripts/media-logo-01f-cohort-validation.ts
 *
 * MEDIA-LOGO-01F — full SAFE_TO_BACKFILL cohort validation (zero persistence).
 *
 * Classifies every backfill-eligible candidate individually using the generic
 * normalization + quality pipeline. No club-specific logic.
 */
import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  decodeProviderLogoDataUri,
  type LogoBackfillCandidatePlan,
} from "@/lib/assets/provider-logo-backfill-planner";
import { normalizeProviderLogoBytes } from "@/lib/assets/provider-logo-normalization";
import {
  assessProviderLogoQuality,
  type ProviderLogoQualityClassification,
} from "@/lib/assets/provider-logo-quality";
import { runProviderLogoBackfillDryRun } from "./media-logo-01d2-provider-logo-backfill-dry-run";

export type CohortQualityClassification =
  | "PASS"
  | "REVIEW_REQUIRED"
  | "FAILED_BACKGROUND_REMOVAL"
  | "FAILED_NORMALIZATION";

export type CohortValidationRow = {
  club: string;
  externalClubId: string;
  sourceMime: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  aspectRatioSource: number | null;
  aspectRatioOutput: number | null;
  alphaPresent: boolean;
  transparentPixelCount: number | null;
  opaquePixelCount: number | null;
  suspiciousExteriorPixelCount: number | null;
  classification: CohortQualityClassification;
  qualityFlags: string[];
  failureReason: string | null;
};

export type CohortValidationReport = {
  evaluatedAt: string;
  plannerSafeToBackfillCount: number;
  totals: Record<CohortQualityClassification, number>;
  bySourceMime: Record<string, Record<CohortQualityClassification, number>>;
  rows: CohortValidationRow[];
  representativePassSamples: string[];
  reviewRequired: string[];
  failed: string[];
};

function aspectRatio(width: number | null, height: number | null): number | null {
  if (!width || !height || height === 0) return null;
  return width / height;
}

function classifyCandidate(
  candidate: LogoBackfillCandidatePlan,
  normalized: Awaited<ReturnType<typeof normalizeProviderLogoBytes>>,
  quality: Awaited<ReturnType<typeof assessProviderLogoQuality>>,
): CohortQualityClassification {
  if (!normalized) {
    return "FAILED_NORMALIZATION";
  }

  if (!quality) {
    return "FAILED_NORMALIZATION";
  }

  return quality.classification;
}

function bumpMimeBucket(
  buckets: Record<string, Record<CohortQualityClassification, number>>,
  mime: string,
  classification: CohortQualityClassification,
): void {
  if (!buckets[mime]) {
    buckets[mime] = {
      PASS: 0,
      REVIEW_REQUIRED: 0,
      FAILED_BACKGROUND_REMOVAL: 0,
      FAILED_NORMALIZATION: 0,
    };
  }
  buckets[mime][classification]++;
}

export async function runCohortValidation(
  prisma: PrismaClient,
): Promise<CohortValidationReport> {
  const plan = await runProviderLogoBackfillDryRun(prisma);
  const safeCandidates = plan.candidates.filter(
    (c) => c.safetyClassification === "SAFE_TO_BACKFILL",
  );

  const totals: Record<CohortQualityClassification, number> = {
    PASS: 0,
    REVIEW_REQUIRED: 0,
    FAILED_BACKGROUND_REMOVAL: 0,
    FAILED_NORMALIZATION: 0,
  };

  const bySourceMime: Record<string, Record<CohortQualityClassification, number>> = {};
  const rows: CohortValidationRow[] = [];

  for (const candidate of safeCandidates) {
    const logoUrl = candidate.currentLogoUrl ?? "";
    const decoded = decodeProviderLogoDataUri(logoUrl);
    const normalized = decoded ? await normalizeProviderLogoBytes(decoded.buffer) : null;
    const quality = normalized ? await assessProviderLogoQuality(normalized.buffer) : null;

    const classification = classifyCandidate(candidate, normalized, quality);
    totals[classification]++;

    const mime = candidate.normalization.sourceFormat ?? "unknown";
    bumpMimeBucket(bySourceMime, mime, classification);

    let failureReason: string | null = null;
    if (classification === "FAILED_NORMALIZATION") {
      failureReason = candidate.normalization.failureReason ?? "normalization_failed";
    } else if (classification === "FAILED_BACKGROUND_REMOVAL") {
      failureReason = quality?.flags.join(";") ?? "background_removal_failed";
    } else if (classification === "REVIEW_REQUIRED") {
      failureReason = quality?.flags.join(";") ?? "review_required";
    }

    rows.push({
      club: candidate.clubName,
      externalClubId: candidate.externalClubId,
      sourceMime: candidate.normalization.sourceFormat,
      sourceWidth: candidate.normalization.sourceWidth,
      sourceHeight: candidate.normalization.sourceHeight,
      outputWidth: normalized?.width ?? null,
      outputHeight: normalized?.height ?? null,
      aspectRatioSource: aspectRatio(
        candidate.normalization.sourceWidth,
        candidate.normalization.sourceHeight,
      ),
      aspectRatioOutput: aspectRatio(normalized?.width ?? null, normalized?.height ?? null),
      alphaPresent: normalized !== null,
      transparentPixelCount: quality?.transparentPixelCount ?? null,
      opaquePixelCount: quality?.opaquePixelCount ?? null,
      suspiciousExteriorPixelCount: quality?.suspiciousExteriorPixelCount ?? null,
      classification,
      qualityFlags: quality?.flags ?? [],
      failureReason,
    });
  }

  const representativePassSamples = rows
    .filter((row) => row.classification === "PASS")
  .slice(0, 12)
    .map((row) => row.club);

  return {
    evaluatedAt: new Date().toISOString(),
    plannerSafeToBackfillCount: safeCandidates.length,
    totals,
    bySourceMime,
    rows,
    representativePassSamples,
    reviewRequired: rows
      .filter((row) => row.classification === "REVIEW_REQUIRED")
      .map((row) => row.club),
    failed: rows
      .filter(
        (row) =>
          row.classification === "FAILED_BACKGROUND_REMOVAL" ||
          row.classification === "FAILED_NORMALIZATION",
      )
      .map((row) => `${row.club} (${row.classification})`),
  };
}

function formatReport(report: CohortValidationReport): string {
  const lines: string[] = [];
  lines.push("============================================================");
  lines.push("MEDIA-LOGO-01F — FULL COHORT VALIDATION");
  lines.push("============================================================");
  lines.push("");
  lines.push(`Evaluated at: ${report.evaluatedAt}`);
  lines.push(`Planner SAFE_TO_BACKFILL count: ${report.plannerSafeToBackfillCount}`);
  lines.push("");
  lines.push("TOTALS");
  for (const [key, value] of Object.entries(report.totals)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push("");
  lines.push("BY SOURCE MIME");
  for (const [mime, bucket] of Object.entries(report.bySourceMime)) {
    lines.push(
      `  ${mime}: PASS=${bucket.PASS} REVIEW=${bucket.REVIEW_REQUIRED} FAILED_BG=${bucket.FAILED_BACKGROUND_REMOVAL} FAILED_NORM=${bucket.FAILED_NORMALIZATION}`,
    );
  }
  lines.push("");
  if (report.reviewRequired.length > 0) {
    lines.push("REVIEW_REQUIRED");
    for (const club of report.reviewRequired) {
      lines.push(`  - ${club}`);
    }
    lines.push("");
  }
  if (report.failed.length > 0) {
    lines.push("FAILED");
    for (const entry of report.failed) {
      lines.push(`  - ${entry}`);
    }
    lines.push("");
  }
  lines.push("PER-CLUB RESULTS");
  for (const row of report.rows) {
    lines.push(
      [
        row.club,
        row.sourceMime ?? "unknown",
        row.sourceWidth && row.sourceHeight ? `${row.sourceWidth}x${row.sourceHeight}` : "n/a",
        row.outputWidth && row.outputHeight ? `${row.outputWidth}x${row.outputHeight}` : "n/a",
        row.classification,
        row.suspiciousExteriorPixelCount ?? "n/a",
        row.failureReason ?? "",
      ].join(" | "),
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[media-logo-01f-cohort] ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const report = await runCohortValidation(prisma);
    const jsonPath = join("/opt/cursor/artifacts", "media-logo-01f-cohort-validation.json");
    const textPath = join("/opt/cursor/artifacts", "media-logo-01f-cohort-validation.txt");

    await writeFile(jsonPath, JSON.stringify(report, null, 2));
    await writeFile(textPath, formatReport(report));

    console.log(formatReport(report));
    console.log("");
    console.log(`JSON: ${jsonPath}`);
    console.log(`TEXT: ${textPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && process.argv[1].endsWith("media-logo-01f-cohort-validation.ts");

if (isDirectExecution) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[media-logo-01f-cohort] FATAL: ${message}`);
    process.exit(1);
  });
}
