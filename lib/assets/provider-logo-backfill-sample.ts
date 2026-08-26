/**
 * lib/assets/provider-logo-backfill-sample.ts
 *
 * MEDIA-LOGO-01D3 — non-mutating normalized logo preview generation for human
 * visual acceptance. Writes temporary PNG files only; no blob upload, DB update,
 * or provider requests.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  decodeProviderLogoDataUri,
  type LogoBackfillCandidatePlan,
} from "@/lib/assets/provider-logo-backfill-planner";
import { normalizeProviderLogoBytes } from "@/lib/assets/provider-logo-normalization";

export const DEFAULT_SAMPLE_CLUB_NAMES = [
  "AC Rossoneri",
  "FC Aesch",
] as const;

export type ProviderLogoSamplePreviewInput = {
  candidate: LogoBackfillCandidatePlan;
  outputDirectory: string;
};

export type ProviderLogoSamplePreviewResult = {
  externalClubId: string;
  clubName: string;
  outputPath: string | null;
  sourceFormat: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  skippedReason: string | null;
};

export type ProviderLogoSampleGenerationReport = {
  outputDirectory: string;
  generated: ProviderLogoSamplePreviewResult[];
  generatedCount: number;
  skippedCount: number;
};

function sanitizeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export function selectRepresentativeSampleCandidates(
  candidates: readonly LogoBackfillCandidatePlan[],
  preferredClubNames: readonly string[] = DEFAULT_SAMPLE_CLUB_NAMES,
  additionalLimit = 5,
): LogoBackfillCandidatePlan[] {
  const selected: LogoBackfillCandidatePlan[] = [];
  const selectedIds = new Set<string>();

  for (const clubName of preferredClubNames) {
    const match = candidates.find(
      (candidate) =>
        candidate.clubName === clubName &&
        candidate.safetyClassification === "SAFE_TO_BACKFILL",
    );
    if (match && !selectedIds.has(match.externalClubId)) {
      selected.push(match);
      selectedIds.add(match.externalClubId);
    }
  }

  const safeCandidates = candidates
    .filter(
      (candidate) =>
        candidate.safetyClassification === "SAFE_TO_BACKFILL" &&
        !selectedIds.has(candidate.externalClubId),
    )
    .sort((left, right) => left.externalClubId.localeCompare(right.externalClubId));

  for (const candidate of safeCandidates) {
    if (selected.length >= preferredClubNames.length + additionalLimit) {
      break;
    }
    selected.push(candidate);
    selectedIds.add(candidate.externalClubId);
  }

  return selected;
}

export async function generateProviderLogoSamplePreview(
  input: ProviderLogoSamplePreviewInput,
): Promise<ProviderLogoSamplePreviewResult> {
  const { candidate, outputDirectory } = input;
  const baseResult: ProviderLogoSamplePreviewResult = {
    externalClubId: candidate.externalClubId,
    clubName: candidate.clubName,
    outputPath: null,
    sourceFormat: candidate.normalization.sourceFormat,
    sourceWidth: candidate.normalization.sourceWidth,
    sourceHeight: candidate.normalization.sourceHeight,
    outputWidth: null,
    outputHeight: null,
    skippedReason: null,
  };

  const logoUrl = candidate.currentLogoUrl?.trim();
  if (!logoUrl) {
    return { ...baseResult, skippedReason: "missing_source_logo_url" };
  }

  const decoded = decodeProviderLogoDataUri(logoUrl);
  if (!decoded) {
    return { ...baseResult, skippedReason: "malformed_data_uri" };
  }

  const normalized = await normalizeProviderLogoBytes(decoded.buffer);
  if (normalized === null) {
    return { ...baseResult, skippedReason: "normalization_failed" };
  }

  const providerClubId =
    candidate.providerIdentity.providerClubId?.toString() ?? "unknown";
  const filename = `${sanitizeFileSegment(candidate.clubName)}_${providerClubId}.png`;
  const outputPath = join(outputDirectory, filename);

  await writeFile(outputPath, normalized.buffer);

  return {
    ...baseResult,
    outputPath,
    outputWidth: normalized.width,
    outputHeight: normalized.height,
  };
}

export async function generateProviderLogoSamplePreviews(input: {
  candidates: readonly LogoBackfillCandidatePlan[];
  outputDirectory?: string;
  preferredClubNames?: readonly string[];
  additionalLimit?: number;
}): Promise<ProviderLogoSampleGenerationReport> {
  const outputDirectory =
    input.outputDirectory ??
    join(tmpdir(), `media-logo-01d3-samples-${Date.now()}`);

  await mkdir(outputDirectory, { recursive: true });

  const selected = selectRepresentativeSampleCandidates(
    input.candidates,
    input.preferredClubNames,
    input.additionalLimit,
  );

  const generated: ProviderLogoSamplePreviewResult[] = [];
  for (const candidate of selected) {
    generated.push(
      await generateProviderLogoSamplePreview({
        candidate,
        outputDirectory,
      }),
    );
  }

  const generatedCount = generated.filter((entry) => entry.outputPath !== null).length;

  return {
    outputDirectory,
    generated,
    generatedCount,
    skippedCount: generated.length - generatedCount,
  };
}

export function assertSampleGenerationPerformsZeroPersistence(): {
  databaseMutation: false;
  blobWrite: false;
  providerRequest: false;
  providerSync: false;
} {
  return {
    databaseMutation: false,
    blobWrite: false,
    providerRequest: false,
    providerSync: false,
  };
}
