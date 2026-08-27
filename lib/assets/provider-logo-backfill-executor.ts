/**
 * lib/assets/provider-logo-backfill-executor.ts
 *
 * MEDIA-LOGO-01D3 — controlled provider-logo backfill executor.
 *
 * Consumes D2 planner output only. Mutates at most one ExternalClub.logoUrl per
 * approved SAFE_TO_BACKFILL candidate: normalize in memory → upload deterministic
 * PNG blob → update logoUrl. Fail-closed on gate mismatch or blocked classification.
 */

import { createHash } from "node:crypto";

import {
  decodeProviderLogoDataUri,
  isManualProtectedClubLogo,
  type BackfillSafetyClassification,
  type LogoBackfillCandidatePlan,
  type ProviderLogoBackfillDryRunPlan,
} from "@/lib/assets/provider-logo-backfill-planner";
import {
  normalizeProviderLogoBytes,
  type NormalizeProviderLogoResult,
} from "@/lib/assets/provider-logo-normalization";
import {
  uploadNormalizedProviderClubLogo,
  type UploadLogoResult,
} from "@/lib/assets/storage";

export const MEDIA_LOGO_01D3_CONFIRMATION = "MEDIA-LOGO-01D3";

export type BackfillExecutionPhase =
  | "gate"
  | "classification"
  | "normalization"
  | "upload"
  | "db_update";

export type BackfillCandidateExecutionOutcome =
  | "SUCCESS"
  | "SKIPPED"
  | "FAILED_NORMALIZATION"
  | "FAILED_UPLOAD"
  | "FAILED_DB_UPDATE"
  | "BLOCKED";

export type BackfillBlockedClassification =
  | "MANUAL_PROTECTED"
  | "REVIEW_REQUIRED"
  | "PROVIDER_MAPPING_MISSING"
  | "PROVIDER_ID_AMBIGUOUS"
  | "ALREADY_NORMALIZED"
  | "NO_ACTION"
  | "ARCHIVED"
  | "UNSAFE_OR_UNKNOWN"
  | "FAILED_NORMALIZATION";

export type ProviderLogoBackfillCandidateResult = {
  externalClubId: string;
  clubName: string;
  outcome: BackfillCandidateExecutionOutcome;
  phase: BackfillExecutionPhase;
  reason: string | null;
  targetStorageKey: string | null;
  uploadedPublicUrl: string | null;
  partialFailure: boolean;
};

export type ProviderLogoBackfillBatchSummary = {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  blobUploads: number;
  databaseUpdates: number;
  blocked: number;
  gateBlocked: boolean;
  gateReason: string | null;
};

export type ProviderLogoBackfillBatchResult = {
  dryRun: boolean;
  planFingerprint: string;
  safeCandidateCount: number;
  summary: ProviderLogoBackfillBatchSummary;
  results: ProviderLogoBackfillCandidateResult[];
};

export type ProviderLogoBackfillExecutionGates = {
  execute: boolean;
  tenantKey: string | null;
  expectedSafeCount: number | null;
  expectedPlanFingerprint: string | null;
  confirm: string | null;
};

export type UpdateExternalClubLogoUrlResult =
  | { ok: true }
  | { ok: false; error: string };

export type ProviderLogoBackfillDependencies = {
  normalizeProviderLogoBytes: (
    sourceBuffer: Buffer,
  ) => Promise<NormalizeProviderLogoResult | null>;
  uploadNormalizedProviderClubLogo: (
    tenantKey: string,
    scope: { provider: string; providerClubId: number },
    buffer: Uint8Array,
  ) => Promise<UploadLogoResult>;
  updateExternalClubLogoUrl: (input: {
    tenantId: string;
    externalClubId: string;
    logoUrl: string;
  }) => Promise<UpdateExternalClubLogoUrlResult>;
};

export const DEFAULT_PROVIDER_LOGO_BACKFILL_DEPENDENCIES: ProviderLogoBackfillDependencies =
  {
    normalizeProviderLogoBytes,
    uploadNormalizedProviderClubLogo,
    updateExternalClubLogoUrl: async () => ({
      ok: false,
      error: "updateExternalClubLogoUrl must be injected for real execution",
    }),
  };

const KNOWN_SAFETY_CLASSIFICATIONS: readonly BackfillSafetyClassification[] = [
  "SAFE_TO_BACKFILL",
  "REVIEW_REQUIRED",
  "FAILED_NORMALIZATION",
  "NO_CHANGE",
];

export function assertKnownBackfillSafetyClassification(
  classification: BackfillSafetyClassification,
): void {
  if (!KNOWN_SAFETY_CLASSIFICATIONS.includes(classification)) {
    throw new Error(`Unexpected safety classification: ${classification}`);
  }
}

export function isAllowedBackfillClassification(
  classification: BackfillSafetyClassification,
): boolean {
  assertKnownBackfillSafetyClassification(classification);
  return classification === "SAFE_TO_BACKFILL";
}

export function mapBlockedClassificationReason(
  plan: LogoBackfillCandidatePlan,
): BackfillBlockedClassification {
  if (plan.selectionCategory === "MANUAL_PROTECTED") {
    return "MANUAL_PROTECTED";
  }
  if (plan.selectionCategory === "ARCHIVED") {
    return "ARCHIVED";
  }
  if (plan.selectionCategory === "ALREADY_NORMALIZED_DATA_URI") {
    return "ALREADY_NORMALIZED";
  }
  if (plan.selectionCategory === "MISSING_SOURCE") {
    return "NO_ACTION";
  }
  if (plan.selectionCategory === "UNSUPPORTED_LOGO") {
    return "UNSAFE_OR_UNKNOWN";
  }
  if (plan.providerIdentity.status === "PROVIDER_MAPPING_MISSING") {
    return "PROVIDER_MAPPING_MISSING";
  }
  if (plan.providerIdentity.status === "PROVIDER_ID_AMBIGUOUS") {
    return "PROVIDER_ID_AMBIGUOUS";
  }
  if (plan.safetyClassification === "REVIEW_REQUIRED") {
    return "REVIEW_REQUIRED";
  }
  if (plan.safetyClassification === "FAILED_NORMALIZATION") {
    return "FAILED_NORMALIZATION";
  }
  if (plan.safetyClassification === "NO_CHANGE") {
    if (plan.blockedReason === "manual_protected") {
      return "MANUAL_PROTECTED";
    }
    return "NO_ACTION";
  }
  return "UNSAFE_OR_UNKNOWN";
}

export function sortBackfillCandidatesDeterministically(
  candidates: readonly LogoBackfillCandidatePlan[],
): LogoBackfillCandidatePlan[] {
  return [...candidates].sort((left, right) => {
    const byClub = left.externalClubId.localeCompare(right.externalClubId);
    if (byClub !== 0) {
      return byClub;
    }
    return (left.providerIdentity.targetStorageKey ?? "").localeCompare(
      right.providerIdentity.targetStorageKey ?? "",
    );
  });
}

export function selectSafeToBackfillCandidates(
  plan: ProviderLogoBackfillDryRunPlan,
): LogoBackfillCandidatePlan[] {
  for (const candidate of plan.candidates) {
    assertKnownBackfillSafetyClassification(candidate.safetyClassification);
  }

  return sortBackfillCandidatesDeterministically(
    plan.candidates.filter(
      (candidate) => candidate.safetyClassification === "SAFE_TO_BACKFILL",
    ),
  );
}

export type BackfillPlanFingerprintEntry = {
  tenantId: string;
  externalClubId: string;
  provider: string | null;
  providerClubId: number | null;
  sourceFingerprint: string | null;
  targetStorageKey: string | null;
  classification: BackfillSafetyClassification;
};

export function buildBackfillPlanFingerprintEntries(
  tenantId: string,
  candidates: readonly LogoBackfillCandidatePlan[],
): BackfillPlanFingerprintEntry[] {
  return sortBackfillCandidatesDeterministically(
    candidates.filter(
      (candidate) => candidate.safetyClassification === "SAFE_TO_BACKFILL",
    ),
  ).map((candidate) => ({
    tenantId,
    externalClubId: candidate.externalClubId,
    provider: candidate.providerIdentity.provider,
    providerClubId: candidate.providerIdentity.providerClubId,
    sourceFingerprint: candidate.normalization.sourceFingerprint,
    targetStorageKey: candidate.providerIdentity.targetStorageKey,
    classification: candidate.safetyClassification,
  }));
}

export function computeBackfillPlanFingerprint(input: {
  tenantId: string;
  candidates: readonly LogoBackfillCandidatePlan[];
}): string {
  const entries = buildBackfillPlanFingerprintEntries(input.tenantId, input.candidates);
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export function validateBackfillExecutionGates(input: {
  gates: ProviderLogoBackfillExecutionGates;
  actualSafeCount: number;
  actualPlanFingerprint: string;
}): { ok: true } | { ok: false; reason: string } {
  const { gates, actualSafeCount, actualPlanFingerprint } = input;

  if (!gates.execute) {
    return { ok: false, reason: "missing_execute_flag" };
  }
  if (!gates.tenantKey?.trim()) {
    return { ok: false, reason: "missing_tenant_gate" };
  }
  if (gates.expectedSafeCount === null) {
    return { ok: false, reason: "missing_expected_safe_count" };
  }
  if (gates.expectedSafeCount !== actualSafeCount) {
    return { ok: false, reason: "safe_count_mismatch" };
  }
  if (!gates.expectedPlanFingerprint?.trim()) {
    return { ok: false, reason: "missing_expected_plan_fingerprint" };
  }
  if (gates.expectedPlanFingerprint !== actualPlanFingerprint) {
    return { ok: false, reason: "plan_fingerprint_mismatch" };
  }
  if (gates.confirm !== MEDIA_LOGO_01D3_CONFIRMATION) {
    return { ok: false, reason: "missing_or_invalid_confirmation" };
  }

  return { ok: true };
}

function blockedCandidateResult(
  plan: LogoBackfillCandidatePlan,
  reason: BackfillBlockedClassification | string,
): ProviderLogoBackfillCandidateResult {
  return {
    externalClubId: plan.externalClubId,
    clubName: plan.clubName,
    outcome: "BLOCKED",
    phase: "classification",
    reason,
    targetStorageKey: plan.providerIdentity.targetStorageKey,
    uploadedPublicUrl: null,
    partialFailure: false,
  };
}

export async function executeProviderLogoBackfillCandidate(input: {
  tenantKey: string;
  tenantId: string;
  candidate: LogoBackfillCandidatePlan;
  dependencies?: ProviderLogoBackfillDependencies;
  allowMutation?: boolean;
}): Promise<ProviderLogoBackfillCandidateResult> {
  const dependencies = input.dependencies ?? DEFAULT_PROVIDER_LOGO_BACKFILL_DEPENDENCIES;
  const allowMutation = input.allowMutation ?? false;
  const { candidate, tenantKey, tenantId } = input;

  assertKnownBackfillSafetyClassification(candidate.safetyClassification);

  if (
    isManualProtectedClubLogo(
      candidate.currentLogoUrl,
      tenantKey,
      candidate.externalClubId,
    )
  ) {
    return blockedCandidateResult(candidate, "MANUAL_PROTECTED");
  }

  if (!isAllowedBackfillClassification(candidate.safetyClassification)) {
    return blockedCandidateResult(candidate, mapBlockedClassificationReason(candidate));
  }

  if (
    candidate.providerIdentity.status !== "PROVIDER_ID_READY" ||
    candidate.providerIdentity.provider === null ||
    candidate.providerIdentity.providerClubId === null ||
    !candidate.providerIdentity.targetStorageKey
  ) {
    return blockedCandidateResult(candidate, mapBlockedClassificationReason(candidate));
  }

  if (!allowMutation) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "SKIPPED",
      phase: "gate",
      reason: "mutation_not_allowed",
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: null,
      partialFailure: false,
    };
  }

  const logoUrl = candidate.currentLogoUrl?.trim();
  if (!logoUrl) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "FAILED_NORMALIZATION",
      phase: "normalization",
      reason: "missing_source_logo_url",
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: null,
      partialFailure: false,
    };
  }

  const decoded = decodeProviderLogoDataUri(logoUrl);
  if (!decoded) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "FAILED_NORMALIZATION",
      phase: "normalization",
      reason: "malformed_data_uri",
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: null,
      partialFailure: false,
    };
  }

  const normalized = await dependencies.normalizeProviderLogoBytes(decoded.buffer);
  if (normalized === null) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "FAILED_NORMALIZATION",
      phase: "normalization",
      reason: "normalization_failed",
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: null,
      partialFailure: false,
    };
  }

  const uploadResult = await dependencies.uploadNormalizedProviderClubLogo(
    tenantKey,
    {
      provider: candidate.providerIdentity.provider,
      providerClubId: candidate.providerIdentity.providerClubId,
    },
    normalized.buffer,
  );

  if (!uploadResult.ok) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "FAILED_UPLOAD",
      phase: "upload",
      reason: uploadResult.error,
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: null,
      partialFailure: false,
    };
  }

  const dbResult = await dependencies.updateExternalClubLogoUrl({
    tenantId,
    externalClubId: candidate.externalClubId,
    logoUrl: uploadResult.publicUrl,
  });

  if (!dbResult.ok) {
    return {
      externalClubId: candidate.externalClubId,
      clubName: candidate.clubName,
      outcome: "FAILED_DB_UPDATE",
      phase: "db_update",
      reason: dbResult.error,
      targetStorageKey: candidate.providerIdentity.targetStorageKey,
      uploadedPublicUrl: uploadResult.publicUrl,
      partialFailure: true,
    };
  }

  return {
    externalClubId: candidate.externalClubId,
    clubName: candidate.clubName,
    outcome: "SUCCESS",
    phase: "db_update",
    reason: null,
    targetStorageKey: candidate.providerIdentity.targetStorageKey,
    uploadedPublicUrl: uploadResult.publicUrl,
    partialFailure: false,
  };
}

export async function executeProviderLogoBackfillBatch(input: {
  plan: ProviderLogoBackfillDryRunPlan;
  gates: ProviderLogoBackfillExecutionGates;
  dependencies?: ProviderLogoBackfillDependencies;
}): Promise<ProviderLogoBackfillBatchResult> {
  const dependencies = input.dependencies ?? DEFAULT_PROVIDER_LOGO_BACKFILL_DEPENDENCIES;
  const safeCandidates = selectSafeToBackfillCandidates(input.plan);
  const planFingerprint = computeBackfillPlanFingerprint({
    tenantId: input.plan.tenantId,
    candidates: input.plan.candidates,
  });

  const gateValidation = validateBackfillExecutionGates({
    gates: input.gates,
    actualSafeCount: safeCandidates.length,
    actualPlanFingerprint: planFingerprint,
  });

  const summary: ProviderLogoBackfillBatchSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    blobUploads: 0,
    databaseUpdates: 0,
    blocked: 0,
    gateBlocked: !gateValidation.ok,
    gateReason: gateValidation.ok ? null : gateValidation.reason,
  };

  const results: ProviderLogoBackfillCandidateResult[] = [];

  if (!gateValidation.ok) {
    for (const candidate of safeCandidates) {
      results.push({
        externalClubId: candidate.externalClubId,
        clubName: candidate.clubName,
        outcome: "SKIPPED",
        phase: "gate",
        reason: gateValidation.reason,
        targetStorageKey: candidate.providerIdentity.targetStorageKey,
        uploadedPublicUrl: null,
        partialFailure: false,
      });
      summary.skipped++;
    }

    return {
      dryRun: !input.gates.execute,
      planFingerprint,
      safeCandidateCount: safeCandidates.length,
      summary,
      results,
    };
  }

  if (input.gates.tenantKey !== input.plan.tenantKey) {
    summary.gateBlocked = true;
    summary.gateReason = "tenant_key_mismatch";
    for (const candidate of safeCandidates) {
      results.push({
        externalClubId: candidate.externalClubId,
        clubName: candidate.clubName,
        outcome: "SKIPPED",
        phase: "gate",
        reason: "tenant_key_mismatch",
        targetStorageKey: candidate.providerIdentity.targetStorageKey,
        uploadedPublicUrl: null,
        partialFailure: false,
      });
      summary.skipped++;
    }

    return {
      dryRun: false,
      planFingerprint,
      safeCandidateCount: safeCandidates.length,
      summary,
      results,
    };
  }

  for (const candidate of safeCandidates) {
    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: input.plan.tenantKey,
      tenantId: input.plan.tenantId,
      candidate,
      dependencies,
      allowMutation: true,
    });
    results.push(result);
  }

  return {
    dryRun: false,
    planFingerprint,
    safeCandidateCount: safeCandidates.length,
    summary: reconcileBatchSummary(results, summary),
    results,
  };
}

function reconcileBatchSummary(
  results: readonly ProviderLogoBackfillCandidateResult[],
  summary: ProviderLogoBackfillBatchSummary,
): ProviderLogoBackfillBatchSummary {
  const reconciled: ProviderLogoBackfillBatchSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    blobUploads: 0,
    databaseUpdates: 0,
    blocked: 0,
    gateBlocked: summary.gateBlocked,
    gateReason: summary.gateReason,
  };

  for (const result of results) {
    if (result.outcome === "SUCCESS") {
      reconciled.attempted++;
      reconciled.succeeded++;
      reconciled.blobUploads++;
      reconciled.databaseUpdates++;
      continue;
    }

    if (result.phase === "gate" && result.outcome === "SKIPPED") {
      reconciled.skipped++;
      continue;
    }

    reconciled.attempted++;

    switch (result.outcome) {
      case "BLOCKED":
        reconciled.blocked++;
        reconciled.failed++;
        break;
      case "SKIPPED":
        reconciled.skipped++;
        break;
      case "FAILED_NORMALIZATION":
        reconciled.failed++;
        break;
      case "FAILED_UPLOAD":
        reconciled.failed++;
        break;
      case "FAILED_DB_UPDATE":
        reconciled.failed++;
        reconciled.blobUploads++;
        break;
      default:
        break;
    }
  }

  return reconciled;
}

export async function previewProviderLogoBackfillBatch(input: {
  plan: ProviderLogoBackfillDryRunPlan;
  gates?: Partial<ProviderLogoBackfillExecutionGates>;
}): Promise<ProviderLogoBackfillBatchResult> {
  const safeCandidates = selectSafeToBackfillCandidates(input.plan);
  const planFingerprint = computeBackfillPlanFingerprint({
    tenantId: input.plan.tenantId,
    candidates: input.plan.candidates,
  });

  const gates: ProviderLogoBackfillExecutionGates = {
    execute: false,
    tenantKey: input.gates?.tenantKey ?? input.plan.tenantKey,
    expectedSafeCount: input.gates?.expectedSafeCount ?? null,
    expectedPlanFingerprint: input.gates?.expectedPlanFingerprint ?? null,
    confirm: input.gates?.confirm ?? null,
  };

  const results: ProviderLogoBackfillCandidateResult[] = [];
  for (const candidate of safeCandidates) {
    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: input.plan.tenantKey,
      tenantId: input.plan.tenantId,
      candidate,
      allowMutation: false,
    });
    results.push(result);
  }

  return {
    dryRun: true,
    planFingerprint,
    safeCandidateCount: safeCandidates.length,
    summary: reconcileBatchSummary(results, {
      attempted: safeCandidates.length,
      succeeded: 0,
      failed: 0,
      skipped: safeCandidates.length,
      blobUploads: 0,
      databaseUpdates: 0,
      blocked: 0,
      gateBlocked: false,
      gateReason: null,
    }),
    results,
  };
}
