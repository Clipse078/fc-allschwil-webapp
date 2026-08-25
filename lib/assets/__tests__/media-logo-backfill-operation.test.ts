/**
 * lib/assets/__tests__/media-logo-backfill-operation.test.ts
 *
 * MEDIA-LOGO-01G4 — focused operation service tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assessMediaLogoBackfillRuntimeEnvironment,
  countMediaLogoQualityMetrics,
  isMediaLogoBackfillRuntimeAllowed,
  MEDIA_LOGO_01G4_FROZEN_CONTRACT,
  runMediaLogoBackfillExecute,
  runMediaLogoBackfillPreflight,
  sanitizeMediaLogoOperationPayload,
  validateMediaLogoFrozenContract,
} from "../media-logo-backfill-operation";
import {
  FC_ALLSCHWIL_STAGE_LOGO_TARGET,
  type LogoBackfillCandidatePlan,
  type ProviderLogoBackfillDryRunPlan,
} from "../provider-logo-backfill-planner";
import { executeProviderLogoBackfillBatch } from "../provider-logo-backfill-executor";

const {
  mockRunProviderLogoBackfillDryRun,
  mockComputeBackfillPlanFingerprint,
  mockExecuteProviderLogoBackfillBatch,
} = vi.hoisted(() => ({
  mockRunProviderLogoBackfillDryRun: vi.fn(),
  mockComputeBackfillPlanFingerprint: vi.fn(),
  mockExecuteProviderLogoBackfillBatch: vi.fn(),
}));

vi.mock("@/scripts/media-logo-01d2-provider-logo-backfill-dry-run", () => ({
  runProviderLogoBackfillDryRun: (...args: unknown[]) =>
    mockRunProviderLogoBackfillDryRun(...args),
}));

vi.mock("../provider-logo-backfill-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../provider-logo-backfill-executor")>();
  return {
    ...actual,
    computeBackfillPlanFingerprint: (...args: unknown[]) =>
      mockComputeBackfillPlanFingerprint(...args),
    executeProviderLogoBackfillBatch: (...args: unknown[]) =>
      mockExecuteProviderLogoBackfillBatch(...args),
  };
});

const ORIGINAL_ENV = { ...process.env };

function makeCandidate(
  overrides: Partial<LogoBackfillCandidatePlan> &
    Pick<LogoBackfillCandidatePlan, "externalClubId" | "clubName">,
): LogoBackfillCandidatePlan {
  return {
    source: "SFV",
    selectionCategory: "NORMALIZE_PROVIDER_SOURCE",
    currentLogoUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    plannedLogoUrl: "https://blob.example/clubs/fc-allschwil/provider/sfv/483.png",
    providerIdentity: {
      status: "PROVIDER_ID_READY",
      provider: "SFV",
      providerClubId: 483,
      targetStorageKey: "clubs/fc-allschwil/provider/sfv/483.png",
      targetBlobUrl: "https://blob.example/clubs/fc-allschwil/provider/sfv/483.png",
    },
    collisionStatus: "NO_COLLISION",
    safetyClassification: "SAFE_TO_BACKFILL",
    normalization: {
      attempted: true,
      succeeded: true,
      sourceFormat: "image/gif",
      sourceWidth: 1,
      sourceHeight: 1,
      outputWidth: 1,
      outputHeight: 1,
      sourceByteSize: 10,
      outputByteSize: 20,
      hasAlpha: true,
      sourceFingerprint: "abc123",
      outputFingerprint: "def456",
      backgroundCleanup: "NO_CLEANUP_REQUIRED",
      opaquePixelRatio: 1,
      failureReason: null,
      qualityClassification: "PASS",
      transparentPixelCount: 1,
      opaquePixelCount: 1,
      suspiciousExteriorPixelCount: 0,
      qualityFlags: [],
    },
    blockedReason: null,
    ...overrides,
  };
}

function makeFcAllschwilCandidate(): LogoBackfillCandidatePlan {
  return makeCandidate({
    externalClubId: "fc-allschwil-id",
    clubName: FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName,
    selectionCategory: "MANUAL_PROTECTED",
    safetyClassification: "NO_CHANGE",
    currentLogoUrl:
      "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/fc-allschwil-id.png",
    providerIdentity: {
      status: "PROVIDER_ID_READY",
      provider: FC_ALLSCHWIL_STAGE_LOGO_TARGET.provider,
      providerClubId: FC_ALLSCHWIL_STAGE_LOGO_TARGET.providerClubId,
      targetStorageKey: "clubs/fc-allschwil/provider/sfv/3502.png",
      targetBlobUrl: "https://blob.example/clubs/fc-allschwil/provider/sfv/3502.png",
    },
    normalization: {
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
    },
  });
}

function makeValidPlan(
  safeCount: number,
  overrides: Partial<ProviderLogoBackfillDryRunPlan> = {},
): ProviderLogoBackfillDryRunPlan {
  const safeCandidates = Array.from({ length: safeCount }, (_, index) =>
    makeCandidate({
      externalClubId: `club-${index}`,
      clubName: `Club ${index}`,
      providerIdentity: {
        status: "PROVIDER_ID_READY",
        provider: "SFV",
        providerClubId: 1000 + index,
        targetStorageKey: `clubs/fc-allschwil/provider/sfv/${1000 + index}.png`,
        targetBlobUrl: `https://blob.example/clubs/fc-allschwil/provider/sfv/${1000 + index}.png`,
      },
    }),
  );

  return {
    tenantKey: MEDIA_LOGO_01G4_FROZEN_CONTRACT.tenantKey,
    tenantId: "tenant-fc-allschwil",
    candidates: [...safeCandidates, makeFcAllschwilCandidate()],
    summary: {
      externalClubRowsEvaluated: 213,
      activeCandidates: 70,
      manualProtected: 10,
      alreadyNormalized: 4,
      archivedSkipped: 131,
      missingSource: 0,
      unsupportedLogo: 0,
      providerMappingMissing: 0,
      providerIdAmbiguous: 0,
      targetCollisions: 0,
      normalizationAttempted: safeCount,
      normalizationSucceeded: safeCount,
      normalizationFailed: 0,
      reviewRequired: 0,
      safeToBackfill: safeCount,
      inputGif: safeCount,
      inputJpeg: 0,
      inputPng: 0,
      inputSvg: 0,
      inputOther: 0,
      cleanupApplied: 0,
      noCleanupRequired: safeCount,
      suspiciousOutput: 0,
      emptyOrInvalidOutput: 0,
      providerIdReady: safeCount,
      deterministicTargetsGenerated: safeCount,
      rowsWouldChange: safeCount,
      rowsProtected: 10,
      rowsBlocked: 16,
      blobUploadsWouldOccur: safeCount,
      databaseUpdatesWouldOccur: safeCount,
      alreadyNormalizedSafeForPromotion: 0,
    },
    d1bComparisons: [],
    d1bMateriallyDifferent: false,
    fcAllschwilVerification: {
      verified: true,
      externalClubId: "fc-allschwil-id",
      logoUrl:
        "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/fc-allschwil-id.png",
      classification: "MANUAL_PROTECTED",
      safetyClassification: "NO_CHANGE",
      details: [],
    },
    collisions: [],
    representativePlans: safeCandidates.slice(0, 3),
    ...overrides,
  };
}

function enableAllowedRuntime() {
  process.env.APP_ENV = "stage";
  process.env.VERCEL = "1";
  process.env.DATABASE_URL = "postgresql://user:secret@ep-stage.example/db";
  process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  enableAllowedRuntime();
  mockComputeBackfillPlanFingerprint.mockReturnValue(
    MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("runtime environment guard", () => {
  it("D. blocks when APP_ENV is not stage", () => {
    process.env.APP_ENV = "local";
    expect(isMediaLogoBackfillRuntimeAllowed()).toBe(false);
  });

  it("D. blocks when not on Vercel runtime", () => {
    delete process.env.VERCEL;
    expect(isMediaLogoBackfillRuntimeAllowed()).toBe(false);
  });

  it("E. blocks when Blob capability is absent", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const environment = assessMediaLogoBackfillRuntimeEnvironment();
    expect(environment.blobCapability).toBe("ABSENT");
    expect(isMediaLogoBackfillRuntimeAllowed(environment)).toBe(false);
  });

  it("reports masked database host metadata without secrets", () => {
    const environment = assessMediaLogoBackfillRuntimeEnvironment();
    expect(environment.databaseHost).toContain(":***@");
    expect(environment.databaseHost).not.toContain("secret");
  });
});

describe("validateMediaLogoFrozenContract", () => {
  it("passes for a contract-aligned plan and fingerprint", () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    const validation = validateMediaLogoFrozenContract(
      plan,
      MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    );

    expect(validation.ok).toBe(true);
    expect(validation.status).toBe("READY");
    expect(validation.quality.safeToBackfill).toBe(54);
    expect(validation.quality.qualityPass).toBe(54);
  });

  it("F. blocks on safe count mismatch", () => {
    const plan = makeValidPlan(53);
    const validation = validateMediaLogoFrozenContract(
      plan,
      MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    );

    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("safe_to_backfill_count_mismatch");
  });

  it("G. blocks on fingerprint mismatch", () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    const validation = validateMediaLogoFrozenContract(plan, "deadbeef");

    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("plan_fingerprint_mismatch");
  });

  it("H. blocks when quality review is present", () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    plan.candidates[0] = makeCandidate({
      externalClubId: "review-club",
      clubName: "Review Club",
      safetyClassification: "REVIEW_REQUIRED",
      normalization: {
        ...makeCandidate({ externalClubId: "x", clubName: "x" }).normalization,
        qualityClassification: "REVIEW_REQUIRED",
      },
    });
    plan.summary.safeToBackfill = 53;

    const validation = validateMediaLogoFrozenContract(
      plan,
      MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    );

    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("safe_to_backfill_count_mismatch");
    expect(validation.reasons).toContain("quality_review_required_present");
  });

  it("I. blocks on collisions", () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible, {
      summary: {
        ...makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible).summary,
        targetCollisions: 1,
      },
      collisions: [
        {
          kind: "TARGET_PATH_COLLISION",
          provider: "SFV",
          providerClubId: 1000,
          targetStorageKey: "clubs/fc-allschwil/provider/sfv/1000.png",
          externalClubIds: ["club-0", "club-1"],
          clubNames: ["Club 0", "Club 1"],
        },
      ],
    });

    const validation = validateMediaLogoFrozenContract(
      plan,
      MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    );

    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("target_collisions_present");
    expect(validation.reasons).toContain("provider_identity_collisions_present");
  });

  it("J. blocks when FC Allschwil is not manual protected", () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    const fcIndex = plan.candidates.findIndex(
      (candidate) => candidate.clubName === FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName,
    );
    plan.candidates[fcIndex] = makeCandidate({
      externalClubId: "fc-allschwil-id",
      clubName: FC_ALLSCHWIL_STAGE_LOGO_TARGET.clubName,
      selectionCategory: "NORMALIZE_PROVIDER_SOURCE",
      safetyClassification: "SAFE_TO_BACKFILL",
    });
    plan.fcAllschwilVerification = {
      verified: false,
      externalClubId: "fc-allschwil-id",
      logoUrl: null,
      classification: "NORMALIZE_PROVIDER_SOURCE",
      safetyClassification: "SAFE_TO_BACKFILL",
      details: ["expected MANUAL_PROTECTED"],
    };

    const validation = validateMediaLogoFrozenContract(
      plan,
      MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    );

    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("fc_allschwil_verification_failed");
  });
});

describe("runMediaLogoBackfillExecute", () => {
  const mockPrisma = {
    externalClub: {
      updateMany: vi.fn(),
    },
  };

  it("K. blocks with missing confirmation and performs zero mutation", async () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    mockRunProviderLogoBackfillDryRun.mockResolvedValue(plan);

    const result = await runMediaLogoBackfillExecute({
      prisma: mockPrisma as never,
      confirmationPhrase: null,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.mutationStarted).toBe(false);
    expect(mockExecuteProviderLogoBackfillBatch).not.toHaveBeenCalled();
    expect(mockPrisma.externalClub.updateMany).not.toHaveBeenCalled();
  });

  it("L. blocks with wrong confirmation and performs zero mutation", async () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    mockRunProviderLogoBackfillDryRun.mockResolvedValue(plan);

    const result = await runMediaLogoBackfillExecute({
      prisma: mockPrisma as never,
      confirmationPhrase: "WRONG",
    });

    expect(result.status).toBe("BLOCKED");
    expect(mockExecuteProviderLogoBackfillBatch).not.toHaveBeenCalled();
  });

  it("M. calls existing executor when confirmation and contract are valid", async () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    const afterPlan = makeValidPlan(0);
    mockRunProviderLogoBackfillDryRun
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(afterPlan);
    mockExecuteProviderLogoBackfillBatch.mockResolvedValue({
      dryRun: false,
      planFingerprint: MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
      safeCandidateCount: 54,
      summary: {
        attempted: 54,
        succeeded: 54,
        failed: 0,
        skipped: 0,
        blobUploads: 54,
        databaseUpdates: 54,
        blocked: 0,
        gateBlocked: false,
        gateReason: null,
      },
      results: [
        {
          externalClubId: "club-0",
          clubName: "Club 0",
          outcome: "SUCCESS",
          phase: "db_update",
          reason: null,
          targetStorageKey: "clubs/fc-allschwil/provider/sfv/1000.png",
          uploadedPublicUrl:
            "https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/1000.png",
          partialFailure: false,
        },
      ],
    });

    const result = await runMediaLogoBackfillExecute({
      prisma: mockPrisma as never,
      confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    });

    expect(result.status).toBe("EXECUTED");
    expect(mockExecuteProviderLogoBackfillBatch).toHaveBeenCalledTimes(1);
    expect(executeProviderLogoBackfillBatch).toBeDefined();
  });

  it("O. recomputes plan immediately before mutation", async () => {
    const plan = makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible);
    const afterPlan = makeValidPlan(0);
    mockRunProviderLogoBackfillDryRun
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(afterPlan);
    mockExecuteProviderLogoBackfillBatch.mockResolvedValue({
      dryRun: false,
      planFingerprint: MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
      safeCandidateCount: 54,
      summary: {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        blobUploads: 0,
        databaseUpdates: 0,
        blocked: 0,
        gateBlocked: false,
        gateReason: null,
      },
      results: [],
    });

    await runMediaLogoBackfillExecute({
      prisma: mockPrisma as never,
      confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    });

    expect(mockRunProviderLogoBackfillDryRun).toHaveBeenCalled();
    expect(mockExecuteProviderLogoBackfillBatch).toHaveBeenCalled();
    expect(mockRunProviderLogoBackfillDryRun.mock.invocationCallOrder[0]).toBeLessThan(
      mockExecuteProviderLogoBackfillBatch.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("S. becomes no-op when post-plan has zero safe candidates", async () => {
    const blockedPlan = makeValidPlan(0, {
      summary: {
        ...makeValidPlan(0).summary,
        safeToBackfill: 0,
      },
      fcAllschwilVerification: makeValidPlan(0).fcAllschwilVerification,
    });
    mockRunProviderLogoBackfillDryRun.mockResolvedValue(blockedPlan);

    const result = await runMediaLogoBackfillExecute({
      prisma: mockPrisma as never,
      confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    });

    expect(result.status).toBe("BLOCKED");
    expect(mockExecuteProviderLogoBackfillBatch).not.toHaveBeenCalled();
  });
});

describe("runMediaLogoBackfillPreflight", () => {
  it("returns READY for a valid contract-aligned plan", async () => {
    mockRunProviderLogoBackfillDryRun.mockResolvedValue(
      makeValidPlan(MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedEligible),
    );

    const result = await runMediaLogoBackfillPreflight({} as never);

    expect(result.status).toBe("READY");
    expect(result.display.eligible).toBe(54);
  });
});

describe("sanitizeMediaLogoOperationPayload", () => {
  it("R. removes secret-like values from serialized payloads", () => {
    const sanitized = sanitizeMediaLogoOperationPayload({
      database: "postgresql://user:secret@ep-stage.example/db",
      auth: "Bearer abc.def.ghi",
      env: "DATABASE_URL=postgresql://user:secret@ep-stage.example/db",
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("Bearer abc");
    expect(serialized).not.toContain("DATABASE_URL=postgresql");
  });
});

describe("countMediaLogoQualityMetrics", () => {
  it("counts PASS only within SAFE_TO_BACKFILL cohort", () => {
    const metrics = countMediaLogoQualityMetrics([
      makeCandidate({ externalClubId: "1", clubName: "One" }),
      makeFcAllschwilCandidate(),
    ]);

    expect(metrics.safeToBackfill).toBe(1);
    expect(metrics.qualityPass).toBe(1);
  });
});
