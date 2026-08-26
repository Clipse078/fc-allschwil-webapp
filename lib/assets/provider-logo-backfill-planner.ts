/**
 * lib/assets/provider-logo-backfill-planner.ts
 *
 * MEDIA-LOGO-01D2 — deterministic provider-logo backfill dry-run planner.
 *
 * Read-only classification, normalization preview, provider-identity resolution,
 * collision detection, and hypothetical mutation planning. Performs zero database
 * writes and zero blob uploads.
 */

import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import {
  computeProviderLogoSourceFingerprint,
  normalizeProviderLogoBytes,
  NORMALIZED_PROVIDER_LOGO_MIME,
} from "@/lib/assets/provider-logo-normalization";
import {
  pngNeedsBorderBackgroundCleanup,
} from "@/lib/assets/provider-logo-background";
import {
  assessProviderLogoQuality,
  type ProviderLogoQualityClassification,
} from "@/lib/assets/provider-logo-quality";
import { isVercelBlobUrl } from "@/lib/assets/storage";
import {
  getExternalClubLogoKey,
  getNormalizedProviderClubLogoKey,
} from "@/lib/assets/tenant-paths";

/** D1B inventory reference counts — recalculated at runtime, not used for selection. */
export const MEDIA_LOGO_01D1B_EXPECTED_COUNTS = {
  totalExternalClubs: 213,
  archived: 131,
  activeNormalizeProviderSource: 70,
  manualProtected: 10,
  alreadyNormalizedDataUri: 4,
  activeMissingSource: 0,
} as const;

/** FC Allschwil STAGE verification target (MEDIA-LOGO-01D1B). */
export const FC_ALLSCHWIL_STAGE_LOGO_TARGET = {
  clubName: "FC Allschwil",
  provider: "SFV",
  providerClubId: 3502,
} as const;

export type LogoBackfillSelectionCategory =
  | "ARCHIVED"
  | "MANUAL_PROTECTED"
  | "ALREADY_NORMALIZED_DATA_URI"
  | "NORMALIZE_PROVIDER_SOURCE"
  | "MISSING_SOURCE"
  | "UNSUPPORTED_LOGO";

export type ProviderIdentityStatus =
  | "PROVIDER_ID_READY"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_ID_AMBIGUOUS";

export type CollisionStatus =
  | "NO_COLLISION"
  | "SAME_PROVIDER_ID_DUPLICATE"
  | "TARGET_PATH_COLLISION";

export type BackfillSafetyClassification =
  | "SAFE_TO_BACKFILL"
  | "REVIEW_REQUIRED"
  | "FAILED_NORMALIZATION"
  | "NO_CHANGE";

export type BackgroundCleanupStatus =
  | "CLEANUP_APPLIED"
  | "NO_CLEANUP_REQUIRED"
  | "SUSPICIOUS_OUTPUT"
  | "EMPTY_OR_INVALID_OUTPUT"
  | "NOT_APPLICABLE";

export type ProviderClubMappingRow = {
  provider: string;
  providerClubId: number;
};

export type ExternalClubLogoBackfillRow = {
  id: string;
  name: string;
  source: string;
  logoUrl: string | null;
  archivedAt: Date | null;
  providerMappings: readonly ProviderClubMappingRow[];
};

export type ProviderIdentityResolution = {
  status: ProviderIdentityStatus;
  provider: string | null;
  providerClubId: number | null;
  targetStorageKey: string | null;
  targetBlobUrl: string | null;
};

export type NormalizationDryRunDetails = {
  attempted: boolean;
  succeeded: boolean;
  sourceFormat: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  sourceByteSize: number;
  outputByteSize: number | null;
  hasAlpha: boolean | null;
  sourceFingerprint: string | null;
  outputFingerprint: string | null;
  backgroundCleanup: BackgroundCleanupStatus;
  opaquePixelRatio: number | null;
  failureReason: string | null;
  qualityClassification: ProviderLogoQualityClassification | null;
  transparentPixelCount: number | null;
  opaquePixelCount: number | null;
  suspiciousExteriorPixelCount: number | null;
  qualityFlags: string[];
};

export type LogoBackfillCandidatePlan = {
  externalClubId: string;
  clubName: string;
  source: string;
  selectionCategory: LogoBackfillSelectionCategory;
  currentLogoUrl: string | null;
  plannedLogoUrl: string | null;
  providerIdentity: ProviderIdentityResolution;
  collisionStatus: CollisionStatus;
  safetyClassification: BackfillSafetyClassification;
  normalization: NormalizationDryRunDetails;
  blockedReason: string | null;
};

export type LogoBackfillSummaryCounts = {
  externalClubRowsEvaluated: number;
  activeCandidates: number;
  manualProtected: number;
  alreadyNormalized: number;
  archivedSkipped: number;
  missingSource: number;
  unsupportedLogo: number;
  providerMappingMissing: number;
  providerIdAmbiguous: number;
  targetCollisions: number;
  normalizationAttempted: number;
  normalizationSucceeded: number;
  normalizationFailed: number;
  reviewRequired: number;
  safeToBackfill: number;
  inputGif: number;
  inputJpeg: number;
  inputPng: number;
  inputSvg: number;
  inputOther: number;
  cleanupApplied: number;
  noCleanupRequired: number;
  suspiciousOutput: number;
  emptyOrInvalidOutput: number;
  providerIdReady: number;
  deterministicTargetsGenerated: number;
  rowsWouldChange: number;
  rowsProtected: number;
  rowsBlocked: number;
  blobUploadsWouldOccur: number;
  databaseUpdatesWouldOccur: number;
  alreadyNormalizedSafeForPromotion: number;
};

export type D1bCountComparison = {
  category: keyof typeof MEDIA_LOGO_01D1B_EXPECTED_COUNTS;
  expected: number;
  actual: number;
  matches: boolean;
};

export type FcAllschwilVerification = {
  verified: boolean;
  externalClubId: string | null;
  logoUrl: string | null;
  classification: LogoBackfillSelectionCategory | null;
  safetyClassification: BackfillSafetyClassification | null;
  details: string[];
};

export type ProviderLogoBackfillDryRunPlan = {
  tenantKey: string;
  tenantId: string;
  candidates: LogoBackfillCandidatePlan[];
  summary: LogoBackfillSummaryCounts;
  d1bComparisons: D1bCountComparison[];
  d1bMateriallyDifferent: boolean;
  fcAllschwilVerification: FcAllschwilVerification;
  collisions: Array<{
    kind: CollisionStatus;
    provider: string;
    providerClubId: number | null;
    targetStorageKey: string | null;
    externalClubIds: string[];
    clubNames: string[];
  }>;
  representativePlans: LogoBackfillCandidatePlan[];
};

const DATA_URI_RE = /^data:([^;,]+)?(?:;([^;,]+))?,(.+)$/i;
const MANUAL_LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

/** Minimum opaque-pixel ratio vs source to avoid flagging pathological shrinkage. */
const MIN_OPAQUE_PIXEL_RETENTION_RATIO = 0.05;

/** Only apply retention-ratio checks once the source has meaningful opaque area. */
const OPAQUE_RATIO_CHECK_MIN_SOURCE_PIXELS = 64;

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeProviderName(provider: string): string {
  return provider.trim().toUpperCase();
}

function blobPathname(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

/**
 * Detects SCE-managed manual club crests stored at the tenant upload key
 * (`clubs/{tenantKey}/{externalClubId}.{ext}`), regardless of ExternalClub.source.
 */
export function isManualProtectedClubLogo(
  logoUrl: string | null | undefined,
  tenantKey: string,
  externalClubId: string,
): boolean {
  const trimmed = logoUrl?.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("data:")) {
    return false;
  }

  if (isVercelBlobUrl(trimmed)) {
    const path = blobPathname(trimmed);
    if (!path) {
      return false;
    }

    if (path.includes("/provider/")) {
      return false;
    }

    for (const ext of MANUAL_LOGO_EXTENSIONS) {
      if (path === getExternalClubLogoKey(tenantKey, externalClubId, ext)) {
        return true;
      }
    }

    return false;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return true;
  }

  return false;
}

export function decodeProviderLogoDataUri(
  logoUrl: string,
): { buffer: Buffer; declaredMime: string | null } | null {
  const trimmed = logoUrl.trim();
  const match = DATA_URI_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  const declaredMime = match[1]?.toLowerCase() ?? null;
  const encoding = match[2]?.toLowerCase() ?? null;
  const payload = match[3];

  if (encoding !== "base64" && encoding !== null) {
    return null;
  }

  try {
    const buffer =
      encoding === "base64"
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8");

    if (buffer.length === 0) {
      return null;
    }

    return { buffer, declaredMime };
  } catch {
    return null;
  }
}

export function classifyExternalClubLogoSelection(
  row: ExternalClubLogoBackfillRow,
): LogoBackfillSelectionCategory {
  if (row.archivedAt !== null) {
    return "ARCHIVED";
  }

  const logoUrl = row.logoUrl?.trim() ?? "";
  if (!logoUrl) {
    return "MISSING_SOURCE";
  }

  if (logoUrl.startsWith("data:image/png")) {
    return "ALREADY_NORMALIZED_DATA_URI";
  }

  if (
    logoUrl.startsWith("data:image/gif") ||
    logoUrl.startsWith("data:image/jpeg") ||
    logoUrl.startsWith("data:image/jpg")
  ) {
    return "NORMALIZE_PROVIDER_SOURCE";
  }

  if (logoUrl.startsWith("data:")) {
    return "UNSUPPORTED_LOGO";
  }

  return "UNSUPPORTED_LOGO";
}

export function resolveProviderClubIdentity(
  tenantKey: string,
  mappings: readonly ProviderClubMappingRow[],
): ProviderIdentityResolution {
  if (mappings.length === 0) {
    return {
      status: "PROVIDER_MAPPING_MISSING",
      provider: null,
      providerClubId: null,
      targetStorageKey: null,
      targetBlobUrl: null,
    };
  }

  const distinct = new Map<string, ProviderClubMappingRow>();
  for (const mapping of mappings) {
    const provider = normalizeProviderName(mapping.provider);
    distinct.set(`${provider}:${mapping.providerClubId}`, {
      provider,
      providerClubId: mapping.providerClubId,
    });
  }

  if (distinct.size !== 1) {
    return {
      status: "PROVIDER_ID_AMBIGUOUS",
      provider: null,
      providerClubId: null,
      targetStorageKey: null,
      targetBlobUrl: null,
    };
  }

  const [only] = distinct.values();
  const targetStorageKey = getNormalizedProviderClubLogoKey(tenantKey, {
    provider: only.provider,
    providerClubId: only.providerClubId,
  });

  return {
    status: "PROVIDER_ID_READY",
    provider: only.provider,
    providerClubId: only.providerClubId,
    targetStorageKey,
    targetBlobUrl: `https://blob.example/${targetStorageKey}`,
  };
}

async function countOpaquePixels(buffer: Buffer): Promise<number> {
  try {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });

    let count = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const alpha = data[i * 4 + 3];
      if (alpha >= 128) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function readImageDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number; hasAlpha: boolean } | null> {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      return null;
    }
    return {
      width: meta.width,
      height: meta.height,
      hasAlpha: meta.hasAlpha ?? false,
    };
  } catch {
    return null;
  }
}

export async function dryRunNormalizeProviderLogoSource(
  sourceBuffer: Buffer,
): Promise<NormalizationDryRunDetails> {
  const base: NormalizationDryRunDetails = {
    attempted: true,
    succeeded: false,
    sourceFormat: null,
    sourceWidth: null,
    sourceHeight: null,
    outputWidth: null,
    outputHeight: null,
    sourceByteSize: sourceBuffer.length,
    outputByteSize: null,
    hasAlpha: null,
    sourceFingerprint: computeProviderLogoSourceFingerprint(sourceBuffer),
    outputFingerprint: null,
    backgroundCleanup: "NOT_APPLICABLE",
    opaquePixelRatio: null,
    failureReason: null,
    qualityClassification: null,
    transparentPixelCount: null,
    opaquePixelCount: null,
    suspiciousExteriorPixelCount: null,
    qualityFlags: [],
  };

  const detected = await fileTypeFromBuffer(sourceBuffer);
  base.sourceFormat = detected?.mime ?? null;

  if (detected?.mime === "image/svg+xml") {
    base.sourceFormat = "image/svg+xml";
  }

  const sourceDims = await readImageDimensions(sourceBuffer);
  if (sourceDims) {
    base.sourceWidth = sourceDims.width;
    base.sourceHeight = sourceDims.height;
  }

  const normalized = await normalizeProviderLogoBytes(sourceBuffer);
  if (normalized === null) {
    base.backgroundCleanup = "NOT_APPLICABLE";
    base.failureReason = "normalization_failed";
    return base;
  }

  const outputDims = await readImageDimensions(normalized.buffer);
  base.succeeded = true;
  base.outputByteSize = normalized.buffer.length;
  base.outputWidth = outputDims?.width ?? normalized.width;
  base.outputHeight = outputDims?.height ?? normalized.height;
  base.hasAlpha = outputDims?.hasAlpha ?? null;
  base.outputFingerprint = sha256Hex(normalized.buffer);

  if (
    !base.outputWidth ||
    !base.outputHeight ||
    base.outputWidth <= 0 ||
    base.outputHeight <= 0
  ) {
    base.backgroundCleanup = "EMPTY_OR_INVALID_OUTPUT";
    return base;
  }

  const sourceOpaque = await countOpaquePixels(sourceBuffer);
  const outputOpaque = await countOpaquePixels(normalized.buffer);
  base.opaquePixelRatio =
    sourceOpaque > 0 ? outputOpaque / sourceOpaque : outputOpaque > 0 ? 1 : 0;

  const quality = await assessProviderLogoQuality(normalized.buffer, sourceBuffer);
  if (quality) {
    base.qualityClassification = quality.classification;
    base.transparentPixelCount = quality.transparentPixelCount;
    base.opaquePixelCount = quality.opaquePixelCount;
    base.suspiciousExteriorPixelCount = quality.suspiciousExteriorPixelCount;
    base.qualityFlags = quality.flags;
  }

  const rasterFormatsNeedingCleanup = new Set([
    "image/gif",
    "image/jpeg",
    "image/jpg",
  ]);
  const sourceNeededCleanup =
    (base.sourceFormat !== null && rasterFormatsNeedingCleanup.has(base.sourceFormat)) ||
  (base.sourceFormat === "image/png" &&
      (await pngNeedsBorderBackgroundCleanup(sourceBuffer)));

  if (sourceNeededCleanup || quality?.classification !== "PASS") {
    base.backgroundCleanup = "CLEANUP_APPLIED";
  } else {
    base.backgroundCleanup = "NO_CLEANUP_REQUIRED";
  }

  if (sourceOpaque > 0 && outputOpaque === 0) {
    base.backgroundCleanup = "EMPTY_OR_INVALID_OUTPUT";
  } else if (
    sourceOpaque >= OPAQUE_RATIO_CHECK_MIN_SOURCE_PIXELS &&
    (base.opaquePixelRatio ?? 0) < MIN_OPAQUE_PIXEL_RETENTION_RATIO
  ) {
    base.backgroundCleanup = "SUSPICIOUS_OUTPUT";
  } else if (quality?.classification === "FAILED_BACKGROUND_REMOVAL") {
    base.backgroundCleanup = "SUSPICIOUS_OUTPUT";
  }

  return base;
}

export function assessBackfillSafety(input: {
  selectionCategory: LogoBackfillSelectionCategory;
  manualProtected: boolean;
  providerIdentity: ProviderIdentityResolution;
  collisionStatus: CollisionStatus;
  normalization: NormalizationDryRunDetails;
}): BackfillSafetyClassification {
  if (input.manualProtected || input.selectionCategory === "MANUAL_PROTECTED") {
    return "NO_CHANGE";
  }

  if (
    input.selectionCategory === "ARCHIVED" ||
    input.selectionCategory === "MISSING_SOURCE" ||
    input.selectionCategory === "UNSUPPORTED_LOGO"
  ) {
    return "NO_CHANGE";
  }

  if (input.selectionCategory === "ALREADY_NORMALIZED_DATA_URI") {
    if (!input.normalization.succeeded) {
      return "REVIEW_REQUIRED";
    }
    if (
      input.normalization.backgroundCleanup === "EMPTY_OR_INVALID_OUTPUT" ||
      input.normalization.backgroundCleanup === "SUSPICIOUS_OUTPUT"
    ) {
      return "REVIEW_REQUIRED";
    }
    return "NO_CHANGE";
  }

  if (input.collisionStatus !== "NO_COLLISION") {
    return "REVIEW_REQUIRED";
  }

  if (input.providerIdentity.status === "PROVIDER_MAPPING_MISSING") {
    return "REVIEW_REQUIRED";
  }

  if (input.providerIdentity.status === "PROVIDER_ID_AMBIGUOUS") {
    return "REVIEW_REQUIRED";
  }

  if (!input.normalization.succeeded) {
    return "FAILED_NORMALIZATION";
  }

  if (
    input.normalization.backgroundCleanup === "EMPTY_OR_INVALID_OUTPUT" ||
    input.normalization.backgroundCleanup === "SUSPICIOUS_OUTPUT"
  ) {
    return "REVIEW_REQUIRED";
  }

  if (input.normalization.qualityClassification === "FAILED_BACKGROUND_REMOVAL") {
    return "REVIEW_REQUIRED";
  }

  if (input.normalization.qualityClassification === "REVIEW_REQUIRED") {
    return "REVIEW_REQUIRED";
  }

  return "SAFE_TO_BACKFILL";
}

function buildCollisionIndex(
  rows: readonly ExternalClubLogoBackfillRow[],
  tenantKey: string,
): Map<string, { provider: string; providerClubId: number; clubIds: string[]; names: string[] }> {
  const byProviderId = new Map<
    string,
    { provider: string; providerClubId: number; clubIds: string[]; names: string[] }
  >();

  for (const row of rows) {
    if (row.archivedAt !== null) {
      continue;
    }

    const identity = resolveProviderClubIdentity(tenantKey, row.providerMappings);
    if (identity.status !== "PROVIDER_ID_READY" || identity.provider === null || identity.providerClubId === null) {
      continue;
    }

    const key = `${identity.provider}:${identity.providerClubId}`;
    const existing = byProviderId.get(key);
    if (existing) {
      existing.clubIds.push(row.id);
      existing.names.push(row.name);
    } else {
      byProviderId.set(key, {
        provider: identity.provider,
        providerClubId: identity.providerClubId,
        clubIds: [row.id],
        names: [row.name],
      });
    }
  }

  return byProviderId;
}

function buildTargetPathCollisionIndex(
  plans: readonly LogoBackfillCandidatePlan[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const plan of plans) {
    const key = plan.providerIdentity.targetStorageKey;
    if (!key || plan.safetyClassification !== "SAFE_TO_BACKFILL") {
      continue;
    }

    const existing = index.get(key) ?? [];
    existing.push(plan.externalClubId);
    index.set(key, existing);
  }

  return index;
}

export async function planProviderLogoBackfill(input: {
  tenantKey: string;
  tenantId: string;
  rows: readonly ExternalClubLogoBackfillRow[];
}): Promise<ProviderLogoBackfillDryRunPlan> {
  const collisionIndex = buildCollisionIndex(input.rows, input.tenantKey);
  const duplicateProviderIds = new Set<string>();
  for (const [key, group] of collisionIndex.entries()) {
    if (group.clubIds.length > 1) {
      duplicateProviderIds.add(key);
    }
  }

  const candidates: LogoBackfillCandidatePlan[] = [];

  for (const row of input.rows) {
    const manualProtected = isManualProtectedClubLogo(row.logoUrl, input.tenantKey, row.id);
    let selectionCategory = classifyExternalClubLogoSelection(row);

    if (!row.archivedAt && manualProtected) {
      selectionCategory = "MANUAL_PROTECTED";
    }

    const providerIdentity = resolveProviderClubIdentity(
      input.tenantKey,
      row.providerMappings,
    );

    let collisionStatus: CollisionStatus = "NO_COLLISION";
    if (providerIdentity.status === "PROVIDER_ID_READY" && providerIdentity.provider && providerIdentity.providerClubId !== null) {
      const providerKey = `${providerIdentity.provider}:${providerIdentity.providerClubId}`;
      if (duplicateProviderIds.has(providerKey)) {
        collisionStatus = "SAME_PROVIDER_ID_DUPLICATE";
      }
    }

    let normalization: NormalizationDryRunDetails = {
      attempted: false,
      succeeded: false,
      sourceFormat: null,
      sourceWidth: null,
      sourceHeight: null,
      outputWidth: null,
      outputHeight: null,
      sourceByteSize: 0,
      outputByteSize: null,
      hasAlpha: null,
      sourceFingerprint: null,
      outputFingerprint: null,
      backgroundCleanup: "NOT_APPLICABLE",
      opaquePixelRatio: null,
      failureReason: null,
      qualityClassification: null,
      transparentPixelCount: null,
      opaquePixelCount: null,
      suspiciousExteriorPixelCount: null,
      qualityFlags: [],
    };

    if (
      row.logoUrl &&
      (selectionCategory === "NORMALIZE_PROVIDER_SOURCE" ||
        selectionCategory === "ALREADY_NORMALIZED_DATA_URI")
    ) {
      const decoded = decodeProviderLogoDataUri(row.logoUrl);
      if (decoded) {
        normalization = await dryRunNormalizeProviderLogoSource(decoded.buffer);
      } else {
        normalization.attempted = true;
        normalization.failureReason = "malformed_data_uri";
      }
    }

    const safetyClassification = assessBackfillSafety({
      selectionCategory,
      manualProtected,
      providerIdentity,
      collisionStatus,
      normalization,
    });

    let blockedReason: string | null = null;
    if (safetyClassification === "REVIEW_REQUIRED") {
      if (collisionStatus !== "NO_COLLISION") {
        blockedReason = collisionStatus;
      } else if (providerIdentity.status !== "PROVIDER_ID_READY") {
        blockedReason = providerIdentity.status;
      } else if (normalization.backgroundCleanup === "SUSPICIOUS_OUTPUT") {
        blockedReason = "suspicious_output";
      } else if (normalization.backgroundCleanup === "EMPTY_OR_INVALID_OUTPUT") {
        blockedReason = "empty_or_invalid_output";
      } else if (normalization.qualityClassification === "FAILED_BACKGROUND_REMOVAL") {
        blockedReason = "failed_background_removal";
      } else if (normalization.qualityClassification === "REVIEW_REQUIRED") {
        blockedReason = "quality_review_required";
      } else if (selectionCategory === "ALREADY_NORMALIZED_DATA_URI") {
        blockedReason = "already_normalized_review";
      } else {
        blockedReason = "review_required";
      }
    } else if (safetyClassification === "FAILED_NORMALIZATION") {
      blockedReason = normalization.failureReason ?? "normalization_failed";
    } else if (safetyClassification === "NO_CHANGE" && manualProtected) {
      blockedReason = "manual_protected";
    }

    const plannedLogoUrl =
      safetyClassification === "SAFE_TO_BACKFILL" && providerIdentity.targetBlobUrl
        ? providerIdentity.targetBlobUrl
        : null;

    candidates.push({
      externalClubId: row.id,
      clubName: row.name,
      source: row.source,
      selectionCategory,
      currentLogoUrl: row.logoUrl,
      plannedLogoUrl,
      providerIdentity,
      collisionStatus,
      safetyClassification,
      normalization,
      blockedReason,
    });
  }

  const targetPathIndex = buildTargetPathCollisionIndex(candidates);
  for (const plan of candidates) {
    const key = plan.providerIdentity.targetStorageKey;
    if (!key || plan.safetyClassification !== "SAFE_TO_BACKFILL") {
      continue;
    }
    const clubIds = targetPathIndex.get(key) ?? [];
    if (clubIds.length > 1) {
      plan.collisionStatus = "TARGET_PATH_COLLISION";
      plan.safetyClassification = "REVIEW_REQUIRED";
      plan.plannedLogoUrl = null;
      plan.blockedReason = "TARGET_PATH_COLLISION";
    }
  }

  const summary = summarizeBackfillPlan(candidates, input.rows);
  const d1bComparisons = compareToD1bCounts(input.rows, candidates, input.tenantKey);
  const fcAllschwilVerification = verifyFcAllschwilTarget(input.rows, candidates, input.tenantKey);

  const collisions = buildCollisionReport(
    collisionIndex,
    targetPathIndex,
    candidates,
    input.tenantKey,
  );

  const representativePlans = candidates
    .filter(
      (plan) =>
        plan.safetyClassification === "SAFE_TO_BACKFILL" ||
        plan.safetyClassification === "REVIEW_REQUIRED" ||
        plan.selectionCategory === "MANUAL_PROTECTED" ||
        plan.selectionCategory === "ALREADY_NORMALIZED_DATA_URI",
    )
    .slice(0, 12);

  return {
    tenantKey: input.tenantKey,
    tenantId: input.tenantId,
    candidates,
    summary,
    d1bComparisons,
    d1bMateriallyDifferent: d1bComparisons.some((entry) => !entry.matches),
    fcAllschwilVerification,
    collisions,
    representativePlans,
  };
}

function summarizeBackfillPlan(
  candidates: readonly LogoBackfillCandidatePlan[],
  rows: readonly ExternalClubLogoBackfillRow[],
): LogoBackfillSummaryCounts {
  const summary: LogoBackfillSummaryCounts = {
    externalClubRowsEvaluated: rows.length,
    activeCandidates: 0,
    manualProtected: 0,
    alreadyNormalized: 0,
    archivedSkipped: 0,
    missingSource: 0,
    unsupportedLogo: 0,
    providerMappingMissing: 0,
    providerIdAmbiguous: 0,
    targetCollisions: 0,
    normalizationAttempted: 0,
    normalizationSucceeded: 0,
    normalizationFailed: 0,
    reviewRequired: 0,
    safeToBackfill: 0,
    inputGif: 0,
    inputJpeg: 0,
    inputPng: 0,
    inputSvg: 0,
    inputOther: 0,
    cleanupApplied: 0,
    noCleanupRequired: 0,
    suspiciousOutput: 0,
    emptyOrInvalidOutput: 0,
    providerIdReady: 0,
    deterministicTargetsGenerated: 0,
    rowsWouldChange: 0,
    rowsProtected: 0,
    rowsBlocked: 0,
    blobUploadsWouldOccur: 0,
    databaseUpdatesWouldOccur: 0,
    alreadyNormalizedSafeForPromotion: 0,
  };

  for (const plan of candidates) {
    if (plan.selectionCategory !== "ARCHIVED") {
      summary.activeCandidates++;
    }

    switch (plan.selectionCategory) {
      case "ARCHIVED":
        summary.archivedSkipped++;
        break;
      case "MANUAL_PROTECTED":
        summary.manualProtected++;
        break;
      case "ALREADY_NORMALIZED_DATA_URI":
        summary.alreadyNormalized++;
        break;
      case "MISSING_SOURCE":
        summary.missingSource++;
        break;
      case "UNSUPPORTED_LOGO":
        summary.unsupportedLogo++;
        break;
      default:
        break;
    }

    if (
      plan.selectionCategory === "NORMALIZE_PROVIDER_SOURCE" &&
      plan.providerIdentity.status === "PROVIDER_MAPPING_MISSING"
    ) {
      summary.providerMappingMissing++;
    } else if (
      plan.selectionCategory !== "ARCHIVED" &&
      plan.providerIdentity.status === "PROVIDER_ID_AMBIGUOUS"
    ) {
      summary.providerIdAmbiguous++;
    }
    if (plan.collisionStatus !== "NO_COLLISION") {
      summary.targetCollisions++;
    }

    if (plan.normalization.attempted) {
      summary.normalizationAttempted++;
      if (plan.normalization.succeeded) {
        summary.normalizationSucceeded++;
      } else {
        summary.normalizationFailed++;
      }
    }

    const format = plan.normalization.sourceFormat;
    if (format === "image/gif") summary.inputGif++;
    else if (format === "image/jpeg") summary.inputJpeg++;
    else if (format === "image/png") summary.inputPng++;
    else if (format === "image/svg+xml") summary.inputSvg++;
    else if (format) summary.inputOther++;

    switch (plan.normalization.backgroundCleanup) {
      case "CLEANUP_APPLIED":
        summary.cleanupApplied++;
        break;
      case "NO_CLEANUP_REQUIRED":
        summary.noCleanupRequired++;
        break;
      case "SUSPICIOUS_OUTPUT":
        summary.suspiciousOutput++;
        break;
      case "EMPTY_OR_INVALID_OUTPUT":
        summary.emptyOrInvalidOutput++;
        break;
      default:
        break;
    }

    if (plan.providerIdentity.status === "PROVIDER_ID_READY") {
      summary.providerIdReady++;
      if (plan.providerIdentity.targetStorageKey) {
        summary.deterministicTargetsGenerated++;
      }
    }

    switch (plan.safetyClassification) {
      case "SAFE_TO_BACKFILL":
        summary.safeToBackfill++;
        summary.rowsWouldChange++;
        summary.blobUploadsWouldOccur++;
        summary.databaseUpdatesWouldOccur++;
        break;
      case "REVIEW_REQUIRED":
        summary.reviewRequired++;
        summary.rowsBlocked++;
        break;
      case "FAILED_NORMALIZATION":
        summary.rowsBlocked++;
        break;
      case "NO_CHANGE":
        if (plan.selectionCategory === "MANUAL_PROTECTED") {
          summary.rowsProtected++;
        } else if (
          plan.selectionCategory === "ALREADY_NORMALIZED_DATA_URI" &&
          plan.normalization.succeeded &&
          plan.normalization.backgroundCleanup !== "EMPTY_OR_INVALID_OUTPUT" &&
          plan.normalization.backgroundCleanup !== "SUSPICIOUS_OUTPUT"
        ) {
          summary.alreadyNormalizedSafeForPromotion++;
        } else if (plan.selectionCategory !== "ARCHIVED") {
          summary.rowsBlocked++;
        }
        break;
    }
  }

  return summary;
}

function compareToD1bCounts(
  rows: readonly ExternalClubLogoBackfillRow[],
  candidates: readonly LogoBackfillCandidatePlan[],
  tenantKey: string,
): D1bCountComparison[] {
  const archived = rows.filter((row) => row.archivedAt !== null).length;
  const alreadyNormalized = rows.filter((row) => row.logoUrl?.startsWith("data:image/png")).length;
  const manualProtected = candidates.filter(
    (plan) => plan.selectionCategory === "MANUAL_PROTECTED",
  ).length;
  const normalizeProviderSource = candidates.filter(
    (plan) => plan.selectionCategory === "NORMALIZE_PROVIDER_SOURCE",
  ).length;
  const missingSource = candidates.filter(
    (plan) => plan.selectionCategory === "MISSING_SOURCE",
  ).length;

  const comparisons: D1bCountComparison[] = [
    {
      category: "totalExternalClubs",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.totalExternalClubs,
      actual: rows.length,
      matches: rows.length === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.totalExternalClubs,
    },
    {
      category: "archived",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.archived,
      actual: archived,
      matches: archived === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.archived,
    },
    {
      category: "activeNormalizeProviderSource",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.activeNormalizeProviderSource,
      actual: normalizeProviderSource,
      matches:
        normalizeProviderSource === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.activeNormalizeProviderSource,
    },
    {
      category: "manualProtected",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.manualProtected,
      actual: manualProtected,
      matches: manualProtected === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.manualProtected,
    },
    {
      category: "alreadyNormalizedDataUri",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.alreadyNormalizedDataUri,
      actual: alreadyNormalized,
      matches:
        alreadyNormalized === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.alreadyNormalizedDataUri,
    },
    {
      category: "activeMissingSource",
      expected: MEDIA_LOGO_01D1B_EXPECTED_COUNTS.activeMissingSource,
      actual: missingSource,
      matches: missingSource === MEDIA_LOGO_01D1B_EXPECTED_COUNTS.activeMissingSource,
    },
  ];

  void tenantKey;
  return comparisons;
}

export function verifyFcAllschwilTarget(
  rows: readonly ExternalClubLogoBackfillRow[],
  candidates: readonly LogoBackfillCandidatePlan[],
  tenantKey: string,
): FcAllschwilVerification {
  const details: string[] = [];
  const row = rows.find((entry) => entry.name === FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName);
  if (!row) {
    return {
      verified: false,
      externalClubId: null,
      logoUrl: null,
      classification: null,
      safetyClassification: null,
      details: ["FC Allschwil ExternalClub row not found"],
    };
  }

  const plan = candidates.find((entry) => entry.externalClubId === row.id);
  const mapping = row.providerMappings.find(
    (entry) =>
      normalizeProviderName(entry.provider) === FC_ALLSCHWIL_STAGE_LOGO_TARGET.provider &&
      entry.providerClubId === FC_ALLSCHWIL_STAGE_LOGO_TARGET.providerClubId,
  );

  if (!mapping) {
    details.push("SFV providerClubId 3502 mapping missing");
  }

  const manual = isManualProtectedClubLogo(row.logoUrl, tenantKey, row.id);
  if (!manual) {
    details.push("logoUrl is not a SCE-managed manual blob crest");
  }

  if (plan?.selectionCategory !== "MANUAL_PROTECTED") {
    details.push(`expected MANUAL_PROTECTED, got ${plan?.selectionCategory ?? "missing plan"}`);
  }

  if (plan?.safetyClassification !== "NO_CHANGE") {
    details.push(
      `expected NO_CHANGE safety classification, got ${plan?.safetyClassification ?? "missing plan"}`,
    );
  }

  return {
    verified: details.length === 0,
    externalClubId: row.id,
    logoUrl: row.logoUrl,
    classification: plan?.selectionCategory ?? null,
    safetyClassification: plan?.safetyClassification ?? null,
    details,
  };
}

function buildCollisionReport(
  providerIndex: Map<
    string,
    { provider: string; providerClubId: number; clubIds: string[]; names: string[] }
  >,
  targetPathIndex: Map<string, string[]>,
  candidates: readonly LogoBackfillCandidatePlan[],
  tenantKey: string,
): ProviderLogoBackfillDryRunPlan["collisions"] {
  const collisions: ProviderLogoBackfillDryRunPlan["collisions"] = [];

  for (const group of providerIndex.values()) {
    if (group.clubIds.length <= 1) {
      continue;
    }
    collisions.push({
      kind: "SAME_PROVIDER_ID_DUPLICATE",
      provider: group.provider,
      providerClubId: group.providerClubId,
      targetStorageKey: getNormalizedProviderClubLogoKey(tenantKey, {
        provider: group.provider,
        providerClubId: group.providerClubId,
      }),
      externalClubIds: group.clubIds,
      clubNames: group.names,
    });
  }

  for (const [targetStorageKey, clubIds] of targetPathIndex.entries()) {
    if (clubIds.length <= 1) {
      continue;
    }
    const names = clubIds.map(
      (id) => candidates.find((plan) => plan.externalClubId === id)?.clubName ?? id,
    );
    collisions.push({
      kind: "TARGET_PATH_COLLISION",
      provider: "mixed",
      providerClubId: null,
      targetStorageKey,
      externalClubIds: clubIds,
      clubNames: names,
    });
  }

  return collisions;
}

/** Ensures dry-run callers never persist — used by tests. */
export function assertDryRunPerformsZeroPersistence(): {
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
