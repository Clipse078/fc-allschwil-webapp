/**
 * lib/assets/media-logo-backfill-operation.ts
 *
 * TEMPORARY MEDIA-LOGO-01G4 operational service.
 * Remove after successful backfill verification before STAGE merge.
 *
 * Authenticated Vercel-runtime execution surface for the approved
 * MEDIA-LOGO provider-logo backfill. Reuses the existing D2 planner and D3
 * executor only — no parallel mutation logic.
 */

import type { PrismaClient } from "@prisma/client";

import { getRuntimeEnvironment } from "@/lib/env";
import {
  MEDIA_LOGO_01G4_FROZEN_CONTRACT,
  MEDIA_LOGO_BACKFILL_TENANT_KEY,
  type MediaLogoContractValidation,
  type MediaLogoExecuteResult,
  type MediaLogoExecutionResultSummary,
  type MediaLogoPostVerification,
  type MediaLogoPreflightResult,
  type MediaLogoQualityContractCounts,
  type MediaLogoRuntimeEnvironmentReport,
} from "@/lib/assets/media-logo-backfill-operation-contract";
import {
  computeBackfillPlanFingerprint,
  executeProviderLogoBackfillBatch,
  type ProviderLogoBackfillBatchResult,
  type ProviderLogoBackfillCandidateResult,
} from "@/lib/assets/provider-logo-backfill-executor";
import {
  FC_ALLSCHWIL_STAGE_LOGO_TARGET,
  type LogoBackfillCandidatePlan,
  type ProviderLogoBackfillDryRunPlan,
} from "@/lib/assets/provider-logo-backfill-planner";
import { normalizeProviderLogoBytes } from "@/lib/assets/provider-logo-normalization";
import { uploadNormalizedProviderClubLogo } from "@/lib/assets/storage";
import { maskDatabaseUrl } from "@/lib/test/safe-test-database";
import { runProviderLogoBackfillDryRun } from "@/scripts/media-logo-01d2-provider-logo-backfill-dry-run";

export {
  MEDIA_LOGO_01G4_FROZEN_CONTRACT,
  MEDIA_LOGO_BACKFILL_TENANT_KEY,
} from "@/lib/assets/media-logo-backfill-operation-contract";
export type {
  MediaLogoBackfillOperationStatus,
  MediaLogoContractValidation,
  MediaLogoExecuteResult,
  MediaLogoExecutionResultSummary,
  MediaLogoPostVerification,
  MediaLogoPreflightResult,
  MediaLogoQualityContractCounts,
  MediaLogoRuntimeEnvironmentReport,
} from "@/lib/assets/media-logo-backfill-operation-contract";

export function hasBlobStorageCapability(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function assessMediaLogoBackfillRuntimeEnvironment(): MediaLogoRuntimeEnvironmentReport {
  const runtime = getRuntimeEnvironment();

  return {
    tenantKey: MEDIA_LOGO_BACKFILL_TENANT_KEY,
    appEnv: runtime.appEnv,
    vercelEnv: runtime.vercelEnv,
    isStageDatabase: runtime.isStage,
    isVercelRuntime: runtime.isVercel,
    databaseUrl: runtime.hasDatabaseUrl ? "PRESENT" : "ABSENT",
    databaseHost: maskDatabaseUrl(process.env.DATABASE_URL),
    blobCapability: hasBlobStorageCapability() ? "PRESENT" : "ABSENT",
  };
}

export function isMediaLogoBackfillRuntimeAllowed(
  environment: MediaLogoRuntimeEnvironmentReport = assessMediaLogoBackfillRuntimeEnvironment(),
): boolean {
  return (
    environment.isStageDatabase &&
    environment.isVercelRuntime &&
    environment.databaseUrl === "PRESENT" &&
    environment.blobCapability === "PRESENT"
  );
}

export function countMediaLogoQualityMetrics(
  candidates: readonly LogoBackfillCandidatePlan[],
): MediaLogoQualityContractCounts {
  let qualityPass = 0;
  let qualityReviewRequired = 0;
  let failedBackgroundRemoval = 0;
  let failedNormalization = 0;
  let safeToBackfill = 0;

  for (const candidate of candidates) {
    if (candidate.safetyClassification === "SAFE_TO_BACKFILL") {
      safeToBackfill++;
      if (candidate.normalization.qualityClassification === "PASS") {
        qualityPass++;
      }
    }

    if (candidate.safetyClassification === "FAILED_NORMALIZATION") {
      failedNormalization++;
    }

    switch (candidate.normalization.qualityClassification) {
      case "REVIEW_REQUIRED":
        qualityReviewRequired++;
        break;
      case "FAILED_BACKGROUND_REMOVAL":
        failedBackgroundRemoval++;
        break;
      default:
        break;
    }
  }

  return {
    safeToBackfill,
    qualityPass,
    qualityReviewRequired,
    failedBackgroundRemoval,
    failedNormalization,
  };
}

export function validateMediaLogoFrozenContract(
  plan: ProviderLogoBackfillDryRunPlan,
  planFingerprint: string,
): MediaLogoContractValidation {
  const reasons: string[] = [];
  const quality = countMediaLogoQualityMetrics(plan.candidates);

  if (plan.tenantKey !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.tenantKey) {
    reasons.push("tenant_key_mismatch");
  }

  if (quality.safeToBackfill !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible) {
    reasons.push("safe_to_backfill_count_mismatch");
  }

  if (quality.qualityPass !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible) {
    reasons.push("quality_pass_count_mismatch");
  }

  if (quality.qualityReviewRequired !== 0) {
    reasons.push("quality_review_required_present");
  }

  if (quality.failedBackgroundRemoval !== 0) {
    reasons.push("failed_background_removal_present");
  }

  if (quality.failedNormalization !== 0) {
    reasons.push("failed_normalization_present");
  }

  if (planFingerprint !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint) {
    reasons.push("plan_fingerprint_mismatch");
  }

  if (plan.summary.targetCollisions !== 0) {
    reasons.push("target_collisions_present");
  }

  if (plan.summary.providerIdAmbiguous !== 0 || plan.collisions.length > 0) {
    reasons.push("provider_identity_collisions_present");
  }

  if (!plan.fcAllschwilVerification.verified) {
    reasons.push("fc_allschwil_verification_failed");
  } else {
    const fcPlan = plan.candidates.find(
      (candidate) => candidate.clubName === FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName,
    );

    if (fcPlan?.selectionCategory !== "MANUAL_PROTECTED") {
      reasons.push("fc_allschwil_not_manual_protected");
    }

    if (fcPlan?.safetyClassification !== "NO_CHANGE") {
      reasons.push("fc_allschwil_not_no_change");
    }

    if (
      fcPlan?.providerIdentity.provider !== FC_ALLSCHWIL_STAGE_LOGO_TARGET.provider ||
      fcPlan?.providerIdentity.providerClubId !== FC_ALLSCHWIL_STAGE_LOGO_TARGET.providerClubId
    ) {
      reasons.push("fc_allschwil_provider_identity_mismatch");
    }
  }

  const environment = assessMediaLogoBackfillRuntimeEnvironment();
  if (!isMediaLogoBackfillRuntimeAllowed(environment)) {
    reasons.push("runtime_environment_not_allowed");
  }

  const blocked =
    plan.summary.rowsBlocked +
    plan.summary.reviewRequired +
    plan.summary.normalizationFailed;

  return {
    ok: reasons.length === 0,
    status: reasons.length === 0 ? "READY" : "BLOCKED",
    reasons,
    planFingerprint,
    quality,
    targetCollisions: plan.summary.targetCollisions,
    providerIdentityCollisions: plan.summary.providerIdAmbiguous + plan.collisions.length,
    manualProtected: plan.summary.manualProtected,
    blocked,
    fcAllschwilVerified: plan.fcAllschwilVerification.verified,
  };
}

function buildPreflightDisplay(contract: MediaLogoContractValidation): MediaLogoPreflightResult["display"] {
  const fingerprint = contract.planFingerprint;
  const shortFingerprint =
    fingerprint.length > 12
      ? `${fingerprint.slice(0, 8)}...${fingerprint.slice(-6)}`
      : fingerprint;

  return {
    tenantLabel: "FC Allschwil",
    eligible: contract.quality.safeToBackfill,
    qualityPass: contract.quality.qualityPass,
    planFingerprint: shortFingerprint,
    manualProtected: contract.manualProtected,
    blocked: contract.blocked,
  };
}

export async function runMediaLogoBackfillPreflight(
  prisma: PrismaClient,
): Promise<MediaLogoPreflightResult> {
  const environment = assessMediaLogoBackfillRuntimeEnvironment();
  const plan = await runProviderLogoBackfillDryRun(prisma, MEDIA_LOGO_BACKFILL_TENANT_KEY);
  const planFingerprint = computeBackfillPlanFingerprint({
    tenantId: plan.tenantId,
    candidates: plan.candidates,
  });
  const contract = validateMediaLogoFrozenContract(plan, planFingerprint);

  return {
    status: contract.status,
    environment,
    contract,
    display: buildPreflightDisplay(contract),
  };
}

function summarizeExecutionResults(
  results: readonly ProviderLogoBackfillCandidateResult[],
): MediaLogoExecutionResultSummary {
  let failedNormalization = 0;
  let failedQuality = 0;
  let failedUpload = 0;
  let failedDbUpdate = 0;
  let partialFailures = 0;
  let successful = 0;
  let skipped = 0;
  let attempted = 0;

  for (const result of results) {
    if (result.partialFailure) {
      partialFailures++;
    }

    switch (result.outcome) {
      case "SUCCESS":
        attempted++;
        successful++;
        break;
      case "SKIPPED":
        skipped++;
        break;
      case "FAILED_NORMALIZATION":
        attempted++;
        failedNormalization++;
        break;
      case "FAILED_UPLOAD":
        attempted++;
        failedUpload++;
        break;
      case "FAILED_DB_UPDATE":
        attempted++;
        failedDbUpdate++;
        break;
      case "BLOCKED":
        attempted++;
        if (
          result.reason === "REVIEW_REQUIRED" ||
          result.reason === "FAILED_NORMALIZATION"
        ) {
          failedQuality++;
        }
        break;
      default:
        break;
    }
  }

  return {
    attempted,
    successful,
    skipped,
    failedNormalization,
    failedQuality,
    failedUpload,
    failedDbUpdate,
    partialFailures,
  };
}

async function buildPostVerification(
  prisma: PrismaClient,
  batchResult: ProviderLogoBackfillBatchResult,
): Promise<MediaLogoPostVerification> {
  const afterPlan = await runProviderLogoBackfillDryRun(prisma, MEDIA_LOGO_BACKFILL_TENANT_KEY);

  const canonicalBlobUrls = batchResult.results
    .filter((result) => result.outcome === "SUCCESS" && result.uploadedPublicUrl)
    .map((result) => result.uploadedPublicUrl as string);

  const fcCandidate = afterPlan.candidates.find(
    (candidate) => candidate.clubName === FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName,
  );

  return {
    remainingSafeToBackfill: afterPlan.summary.safeToBackfill,
    canonicalBlobUrls,
    manualProtected: afterPlan.summary.manualProtected,
    fcAllschwilUnchanged:
      fcCandidate?.selectionCategory === "MANUAL_PROTECTED" &&
      fcCandidate.safetyClassification === "NO_CHANGE",
  };
}

export async function runMediaLogoBackfillExecute(input: {
  prisma: PrismaClient;
  confirmationPhrase: string | null | undefined;
}): Promise<MediaLogoExecuteResult> {
  const environment = assessMediaLogoBackfillRuntimeEnvironment();

  const plan = await runProviderLogoBackfillDryRun(
    input.prisma,
    MEDIA_LOGO_BACKFILL_TENANT_KEY,
  );
  const planFingerprint = computeBackfillPlanFingerprint({
    tenantId: plan.tenantId,
    candidates: plan.candidates,
  });
  const contract = validateMediaLogoFrozenContract(plan, planFingerprint);

  if (input.confirmationPhrase !== MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase) {
    return {
      status: "BLOCKED",
      mutationStarted: false,
      environment,
      contract,
      execution: null,
      postVerification: null,
      gateReason: "missing_or_invalid_confirmation",
    };
  }

  if (!contract.ok) {
    return {
      status: "BLOCKED",
      mutationStarted: false,
      environment,
      contract,
      execution: null,
      postVerification: null,
      gateReason: contract.reasons[0] ?? "contract_validation_failed",
    };
  }

  const batchResult = await executeProviderLogoBackfillBatch({
    plan,
    gates: {
      execute: true,
      tenantKey: MEDIA_LOGO_01G4_FROZEN_CONTRACT.tenantKey,
      expectedSafeCount: MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible,
      expectedPlanFingerprint: MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
      confirm: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    },
    dependencies: {
      normalizeProviderLogoBytes,
      uploadNormalizedProviderClubLogo,
      updateExternalClubLogoUrl: async ({ tenantId, externalClubId, logoUrl }) => {
        const updateResult = await input.prisma.externalClub.updateMany({
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

  if (batchResult.summary.gateBlocked) {
    return {
      status: "BLOCKED",
      mutationStarted: false,
      environment,
      contract,
      execution: summarizeExecutionResults(batchResult.results),
      postVerification: null,
      gateReason: batchResult.summary.gateReason,
    };
  }

  const execution = summarizeExecutionResults(batchResult.results);
  const postVerification = await buildPostVerification(input.prisma, batchResult);

  if (execution.successful === 0 && execution.attempted === 0) {
    return {
      status: "NO_OP",
      mutationStarted: false,
      environment,
      contract,
      execution,
      postVerification,
      gateReason: null,
    };
  }

  return {
    status: "EXECUTED",
    mutationStarted: execution.successful > 0,
    environment,
    contract,
    execution,
    postVerification,
    gateReason: null,
  };
}

export function sanitizeMediaLogoOperationPayload<T>(payload: T): T {
  const serialized = JSON.stringify(payload);
  const redacted = serialized
    .replace(/BLOB_READ_WRITE_TOKEN/g, "[REDACTED]")
    .replace(/DATABASE_URL/g, "[REDACTED]")
    .replace(/postgresql:\/\/[^"]+/g, "[REDACTED_DB_URL]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");

  return JSON.parse(redacted) as T;
}
