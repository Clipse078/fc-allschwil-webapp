/**
 * scripts/media-logo-01f-quality-dry-run.ts
 *
 * MEDIA-LOGO-01F — full SAFE_TO_BACKFILL cohort quality dry run (zero persistence).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import { decodeProviderLogoDataUri } from "@/lib/assets/provider-logo-backfill-planner";
import { normalizeProviderLogoBytes } from "@/lib/assets/provider-logo-normalization";
import { assessProviderLogoQuality } from "@/lib/assets/provider-logo-quality";
import { runProviderLogoBackfillDryRun } from "./media-logo-01d2-provider-logo-backfill-dry-run";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const plan = await runProviderLogoBackfillDryRun(prisma);
    const safeCandidates = plan.candidates.filter(
      (c) => c.safetyClassification === "SAFE_TO_BACKFILL",
    );

    const totals = { PASS: 0, REVIEW_REQUIRED: 0, FAILED: 0 };
    const rows: Array<Record<string, unknown>> = [];

    for (const candidate of safeCandidates) {
      const logoUrl = candidate.currentLogoUrl ?? "";
      const decoded = decodeProviderLogoDataUri(logoUrl);
      const normalized = decoded ? await normalizeProviderLogoBytes(decoded.buffer) : null;
      const quality = normalized ? await assessProviderLogoQuality(normalized.buffer) : null;

      const classification = quality?.classification ?? "FAILED";
      if (classification === "PASS") totals.PASS++;
      else if (classification === "REVIEW_REQUIRED") totals.REVIEW_REQUIRED++;
      else totals.FAILED++;

      rows.push({
        club: candidate.clubName,
        sourceMime: candidate.normalization.sourceFormat,
        sourceDimensions:
          candidate.normalization.sourceWidth && candidate.normalization.sourceHeight
            ? `${candidate.normalization.sourceWidth}x${candidate.normalization.sourceHeight}`
            : null,
        outputDimensions: normalized
          ? `${normalized.width}x${normalized.height}`
          : null,
        alphaPresent: normalized !== null,
        transparentPixelCount: quality?.transparentPixelCount ?? null,
        opaquePixelCount: quality?.opaquePixelCount ?? null,
        suspiciousExteriorPixelCount: quality?.suspiciousExteriorPixelCount ?? null,
        qualityClassification: classification,
        flags: quality?.flags ?? ["normalize_failed"],
      });
    }

    console.log(
      JSON.stringify(
        {
          safeCandidates: safeCandidates.length,
          totals,
          rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
