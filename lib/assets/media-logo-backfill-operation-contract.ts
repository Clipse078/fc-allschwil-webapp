/**
 * lib/assets/media-logo-backfill-operation-contract.ts
 *
 * Client-safe frozen contract constants for MEDIA-LOGO-01G4.
 */

export const MEDIA_LOGO_BACKFILL_TENANT_KEY = "fc-allschwil";

/** Must match MEDIA_LOGO_01D3_CONFIRMATION in provider-logo-backfill-executor.ts */
export const MEDIA_LOGO_01D3_CONFIRMATION = "MEDIA-LOGO-01D3";

export const MEDIA_LOGO_01G4_FROZEN_CONTRACT = {
  tenantKey: MEDIA_LOGO_BACKFILL_TENANT_KEY,
  expectedEligible: 54,
  expectedFingerprint: "00228828d3445485df4e682877999a2a4fc24d0deae02fbe8323a4e462238be6",
  confirmationPhrase: MEDIA_LOGO_01D3_CONFIRMATION,
} as const;

export type MediaLogoBackfillOperationStatus = "READY" | "BLOCKED";

export type MediaLogoRuntimeEnvironmentReport = {
  tenantKey: string;
  appEnv: "local" | "stage" | "prod";
  vercelEnv: string | null;
  isStageDatabase: boolean;
  isVercelRuntime: boolean;
  databaseUrl: "PRESENT" | "ABSENT";
  databaseHost: string;
  blobCapability: "PRESENT" | "ABSENT";
};

export type MediaLogoQualityContractCounts = {
  safeToBackfill: number;
  qualityPass: number;
  qualityReviewRequired: number;
  failedBackgroundRemoval: number;
  failedNormalization: number;
};

export type MediaLogoContractValidation = {
  ok: boolean;
  status: MediaLogoBackfillOperationStatus;
  reasons: string[];
  planFingerprint: string;
  quality: MediaLogoQualityContractCounts;
  targetCollisions: number;
  providerIdentityCollisions: number;
  manualProtected: number;
  blocked: number;
  fcAllschwilVerified: boolean;
};

export type MediaLogoPreflightResult = {
  status: MediaLogoBackfillOperationStatus;
  environment: MediaLogoRuntimeEnvironmentReport;
  contract: MediaLogoContractValidation;
  display: {
    tenantLabel: string;
    eligible: number;
    qualityPass: number;
    planFingerprint: string;
    manualProtected: number;
    blocked: number;
  };
};

export type MediaLogoExecutionResultSummary = {
  attempted: number;
  successful: number;
  skipped: number;
  failedNormalization: number;
  failedQuality: number;
  failedUpload: number;
  failedDbUpdate: number;
  partialFailures: number;
};

export type MediaLogoPostVerification = {
  remainingSafeToBackfill: number;
  canonicalBlobUrls: string[];
  manualProtected: number;
  fcAllschwilUnchanged: boolean;
};

export type MediaLogoExecuteResult = {
  status: "EXECUTED" | "BLOCKED" | "NO_OP";
  mutationStarted: boolean;
  environment: MediaLogoRuntimeEnvironmentReport;
  contract: MediaLogoContractValidation;
  execution: MediaLogoExecutionResultSummary | null;
  postVerification: MediaLogoPostVerification | null;
  gateReason: string | null;
};
