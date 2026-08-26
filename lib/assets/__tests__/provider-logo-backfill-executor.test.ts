/**
 * MEDIA-LOGO-01D3 — provider logo backfill executor tests.
 */

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  computeBackfillPlanFingerprint,
  executeProviderLogoBackfillBatch,
  executeProviderLogoBackfillCandidate,
  isAllowedBackfillClassification,
  mapBlockedClassificationReason,
  MEDIA_LOGO_01D3_CONFIRMATION,
  previewProviderLogoBackfillBatch,
  sortBackfillCandidatesDeterministically,
  validateBackfillExecutionGates,
  type ProviderLogoBackfillDependencies,
} from "../provider-logo-backfill-executor";
import {
  planProviderLogoBackfill,
  type ExternalClubLogoBackfillRow,
  type LogoBackfillCandidatePlan,
  type ProviderLogoBackfillDryRunPlan,
} from "../provider-logo-backfill-planner";
import {
  assertSampleGenerationPerformsZeroPersistence,
  generateProviderLogoSamplePreview,
  generateProviderLogoSamplePreviews,
  selectRepresentativeSampleCandidates,
} from "../provider-logo-backfill-sample";
import { parseBackfillCliArgs } from "../../../scripts/media-logo-01d3-provider-logo-backfill";

const TENANT_KEY = "fc-allschwil";
const TENANT_ID = "tenant-1";

const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function makeRow(
  overrides: Partial<ExternalClubLogoBackfillRow> & Pick<ExternalClubLogoBackfillRow, "id" | "name">,
): ExternalClubLogoBackfillRow {
  return {
    source: "SFV",
    logoUrl: null,
    archivedAt: null,
    providerMappings: [],
    ...overrides,
  };
}

function makeSafeCandidate(
  overrides: Partial<LogoBackfillCandidatePlan> &
    Pick<LogoBackfillCandidatePlan, "externalClubId" | "clubName">,
): LogoBackfillCandidatePlan {
  return {
    source: "SFV",
    selectionCategory: "NORMALIZE_PROVIDER_SOURCE",
    currentLogoUrl: `data:image/gif;base64,${GIF_BASE64}`,
    plannedLogoUrl: `https://blob.example/clubs/${TENANT_KEY}/provider/sfv/483.png`,
    providerIdentity: {
      status: "PROVIDER_ID_READY",
      provider: "SFV",
      providerClubId: 483,
      targetStorageKey: `clubs/${TENANT_KEY}/provider/sfv/483.png`,
      targetBlobUrl: `https://blob.example/clubs/${TENANT_KEY}/provider/sfv/483.png`,
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
    },
    blockedReason: null,
    ...overrides,
  };
}

async function buildPlan(rows: ExternalClubLogoBackfillRow[]): Promise<ProviderLogoBackfillDryRunPlan> {
  return planProviderLogoBackfill({
    tenantKey: TENANT_KEY,
    tenantId: TENANT_ID,
    rows,
  });
}

function createMockDependencies(
  overrides: Partial<ProviderLogoBackfillDependencies> = {},
): ProviderLogoBackfillDependencies {
  return {
    normalizeProviderLogoBytes: vi.fn(async () => ({
      buffer: Buffer.from(PNG_BASE64, "base64"),
      mime: "image/png" as const,
      sourceFingerprint: "normalized",
      width: 1,
      height: 1,
    })),
    uploadNormalizedProviderClubLogo: vi.fn(async () => ({
      ok: true as const,
      publicUrl: `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/provider/sfv/483.png`,
    })),
    updateExternalClubLogoUrl: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

describe("isAllowedBackfillClassification", () => {
  it("A. only SAFE_TO_BACKFILL enters mutation executor", () => {
    expect(isAllowedBackfillClassification("SAFE_TO_BACKFILL")).toBe(true);
    expect(isAllowedBackfillClassification("REVIEW_REQUIRED")).toBe(false);
    expect(isAllowedBackfillClassification("FAILED_NORMALIZATION")).toBe(false);
    expect(isAllowedBackfillClassification("NO_CHANGE")).toBe(false);
  });

  it("F. unexpected classification fails closed", () => {
    expect(() =>
      isAllowedBackfillClassification("UNEXPECTED" as LogoBackfillCandidatePlan["safetyClassification"]),
    ).toThrow(/Unexpected safety classification/);
  });
});

describe("mapBlockedClassificationReason", () => {
  it("B. manual protected blocked", () => {
    expect(
      mapBlockedClassificationReason(
        makeSafeCandidate({
          externalClubId: "manual",
          clubName: "Manual Club",
          selectionCategory: "MANUAL_PROTECTED",
          safetyClassification: "NO_CHANGE",
        }),
      ),
    ).toBe("MANUAL_PROTECTED");
  });

  it("C. review-required blocked", () => {
    expect(
      mapBlockedClassificationReason(
        makeSafeCandidate({
          externalClubId: "review",
          clubName: "Review Club",
          safetyClassification: "REVIEW_REQUIRED",
        }),
      ),
    ).toBe("REVIEW_REQUIRED");
  });

  it("D. missing provider mapping blocked", () => {
    expect(
      mapBlockedClassificationReason(
        makeSafeCandidate({
          externalClubId: "missing",
          clubName: "Missing Map",
          providerIdentity: {
            status: "PROVIDER_MAPPING_MISSING",
            provider: null,
            providerClubId: null,
            targetStorageKey: null,
            targetBlobUrl: null,
          },
          safetyClassification: "REVIEW_REQUIRED",
        }),
      ),
    ).toBe("PROVIDER_MAPPING_MISSING");
  });

  it("E. normalized candidate blocked", () => {
    expect(
      mapBlockedClassificationReason(
        makeSafeCandidate({
          externalClubId: "normalized",
          clubName: "Normalized Club",
          selectionCategory: "ALREADY_NORMALIZED_DATA_URI",
          safetyClassification: "NO_CHANGE",
        }),
      ),
    ).toBe("ALREADY_NORMALIZED");
  });
});

describe("executeProviderLogoBackfillCandidate", () => {
  it("B. refuses FC Allschwil-like manual Vercel Blob canonical logo", async () => {
    const manualUrl = `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/fc-allschwil-club.png`;
    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "fc-allschwil-club",
        clubName: "FC Allschwil",
        currentLogoUrl: manualUrl,
        source: "SFV",
      }),
      dependencies: createMockDependencies(),
      allowMutation: true,
    });

    expect(result.outcome).toBe("BLOCKED");
    expect(result.reason).toBe("MANUAL_PROTECTED");
  });

  it("manual protection wins even when source field says provider", async () => {
    const dependencies = createMockDependencies();
    const manualUrl = `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/club-manual.png`;

    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "club-manual",
        clubName: "Manual Source Club",
        source: "SFV",
        currentLogoUrl: manualUrl,
      }),
      dependencies,
      allowMutation: true,
    });

    expect(result.outcome).toBe("BLOCKED");
    expect(dependencies.uploadNormalizedProviderClubLogo).not.toHaveBeenCalled();
    expect(dependencies.updateExternalClubLogoUrl).not.toHaveBeenCalled();
  });

  it("I. normalization failure -> zero upload/write", async () => {
    const dependencies = createMockDependencies({
      normalizeProviderLogoBytes: vi.fn(async () => null),
    });

    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "bad-normalize",
        clubName: "Bad Normalize",
      }),
      dependencies,
      allowMutation: true,
    });

    expect(result.outcome).toBe("FAILED_NORMALIZATION");
    expect(dependencies.uploadNormalizedProviderClubLogo).not.toHaveBeenCalled();
    expect(dependencies.updateExternalClubLogoUrl).not.toHaveBeenCalled();
  });

  it("J. upload failure -> zero DB write", async () => {
    const dependencies = createMockDependencies({
      uploadNormalizedProviderClubLogo: vi.fn(async () => ({
        ok: false,
        status: 503,
        error: "upload failed",
      })),
    });

    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "upload-fail",
        clubName: "Upload Fail",
      }),
      dependencies,
      allowMutation: true,
    });

    expect(result.outcome).toBe("FAILED_UPLOAD");
    expect(dependencies.updateExternalClubLogoUrl).not.toHaveBeenCalled();
  });

  it("K. DB failure reported after upload", async () => {
    const dependencies = createMockDependencies({
      updateExternalClubLogoUrl: vi.fn(async () => ({
        ok: false,
        error: "db failed",
      })),
    });

    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "db-fail",
        clubName: "DB Fail",
      }),
      dependencies,
      allowMutation: true,
    });

    expect(result.outcome).toBe("FAILED_DB_UPDATE");
    expect(result.partialFailure).toBe(true);
    expect(result.uploadedPublicUrl).toContain("blob.vercel-storage.com");
    expect(dependencies.uploadNormalizedProviderClubLogo).toHaveBeenCalledTimes(1);
  });

  it("L. success -> one Blob upload + one ExternalClub update", async () => {
    const dependencies = createMockDependencies();

    const result = await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "success",
        clubName: "Success Club",
      }),
      dependencies,
      allowMutation: true,
    });

    expect(result.outcome).toBe("SUCCESS");
    expect(dependencies.normalizeProviderLogoBytes).toHaveBeenCalledTimes(1);
    expect(dependencies.uploadNormalizedProviderClubLogo).toHaveBeenCalledTimes(1);
    expect(dependencies.updateExternalClubLogoUrl).toHaveBeenCalledTimes(1);
    expect(dependencies.updateExternalClubLogoUrl).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      externalClubId: "success",
      logoUrl: expect.stringContaining("blob.vercel-storage.com"),
    });
  });

  it("O. uses deterministic target path on upload", async () => {
    const dependencies = createMockDependencies();

    await executeProviderLogoBackfillCandidate({
      tenantKey: TENANT_KEY,
      tenantId: TENANT_ID,
      candidate: makeSafeCandidate({
        externalClubId: "path-check",
        clubName: "Path Check",
        providerIdentity: {
          status: "PROVIDER_ID_READY",
          provider: "SFV",
          providerClubId: 999,
          targetStorageKey: `clubs/${TENANT_KEY}/provider/sfv/999.png`,
          targetBlobUrl: `https://blob.example/clubs/${TENANT_KEY}/provider/sfv/999.png`,
        },
      }),
      dependencies,
      allowMutation: true,
    });

    expect(dependencies.uploadNormalizedProviderClubLogo).toHaveBeenCalledWith(
      TENANT_KEY,
      { provider: "SFV", providerClubId: 999 },
      expect.any(Buffer),
    );
  });
});

describe("executeProviderLogoBackfillBatch", () => {
  async function planWithSafeRows(): Promise<ProviderLogoBackfillDryRunPlan> {
    return buildPlan([
      makeRow({
        id: "club-z",
        name: "Club Z",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 2 }],
      }),
      makeRow({
        id: "club-a",
        name: "Club A",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 1 }],
      }),
    ]);
  }

  it("G. plan count mismatch -> zero uploads/writes", async () => {
    const plan = await planWithSafeRows();
    const fingerprint = computeBackfillPlanFingerprint({
      tenantId: plan.tenantId,
      candidates: plan.candidates,
    });
    const dependencies = createMockDependencies();

    const result = await executeProviderLogoBackfillBatch({
      plan,
      gates: {
        execute: true,
        tenantKey: TENANT_KEY,
        expectedSafeCount: 999,
        expectedPlanFingerprint: fingerprint,
        confirm: MEDIA_LOGO_01D3_CONFIRMATION,
      },
      dependencies,
    });

    expect(result.summary.gateBlocked).toBe(true);
    expect(result.summary.blobUploads).toBe(0);
    expect(result.summary.databaseUpdates).toBe(0);
    expect(dependencies.uploadNormalizedProviderClubLogo).not.toHaveBeenCalled();
    expect(dependencies.updateExternalClubLogoUrl).not.toHaveBeenCalled();
  });

  it("H. plan fingerprint mismatch -> zero uploads/writes", async () => {
    const plan = await planWithSafeRows();
    const dependencies = createMockDependencies();

    const result = await executeProviderLogoBackfillBatch({
      plan,
      gates: {
        execute: true,
        tenantKey: TENANT_KEY,
        expectedSafeCount: plan.summary.safeToBackfill,
        expectedPlanFingerprint: "deadbeef",
        confirm: MEDIA_LOGO_01D3_CONFIRMATION,
      },
      dependencies,
    });

    expect(result.summary.gateReason).toBe("plan_fingerprint_mismatch");
    expect(result.summary.blobUploads).toBe(0);
    expect(result.summary.databaseUpdates).toBe(0);
    expect(dependencies.uploadNormalizedProviderClubLogo).not.toHaveBeenCalled();
  });

  it("P. deterministic execution ordering", async () => {
    const plan = await planWithSafeRows();
    const ordered = sortBackfillCandidatesDeterministically(
      plan.candidates.filter((candidate) => candidate.safetyClassification === "SAFE_TO_BACKFILL"),
    );

    expect(ordered.map((candidate) => candidate.externalClubId)).toEqual(["club-a", "club-z"]);
  });

  it("M/N. only updates ExternalClub via injected dependency", async () => {
    const plan = await planWithSafeRows();
    const fingerprint = computeBackfillPlanFingerprint({
      tenantId: plan.tenantId,
      candidates: plan.candidates,
    });
    const dependencies = createMockDependencies();

    await executeProviderLogoBackfillBatch({
      plan,
      gates: {
        execute: true,
        tenantKey: TENANT_KEY,
        expectedSafeCount: plan.summary.safeToBackfill,
        expectedPlanFingerprint: fingerprint,
        confirm: MEDIA_LOGO_01D3_CONFIRMATION,
      },
      dependencies,
    });

    expect(dependencies.updateExternalClubLogoUrl).toHaveBeenCalledTimes(plan.summary.safeToBackfill);
    for (const call of vi.mocked(dependencies.updateExternalClubLogoUrl).mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          tenantId: TENANT_ID,
          externalClubId: expect.any(String),
          logoUrl: expect.stringContaining("blob.vercel-storage.com"),
        }),
      );
    }
  });
});

describe("post-migration idempotency", () => {
  it("Q. repeated post-migration plan becomes no-op", async () => {
    const migratedUrl = `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/provider/sfv/483.png`;
    const plan = await buildPlan([
      makeRow({
        id: "migrated",
        name: "Migrated Club",
        logoUrl: migratedUrl,
        providerMappings: [{ provider: "SFV", providerClubId: 483 }],
      }),
    ]);

    expect(plan.summary.safeToBackfill).toBe(0);
    expect(plan.summary.unsupportedLogo).toBeGreaterThan(0);
  });
});

describe("CLI gates", () => {
  it("R. CLI missing --execute -> zero mutation", () => {
    const args = parseBackfillCliArgs([]);
    expect(args.execute).toBe(false);
    expect(validateBackfillExecutionGates({
      gates: args,
      actualSafeCount: 59,
      actualPlanFingerprint: "abc",
    }).ok).toBe(false);
  });

  it("S. CLI missing confirmation gates -> zero mutation", () => {
    expect(
      validateBackfillExecutionGates({
        gates: {
          execute: true,
          tenantKey: TENANT_KEY,
          expectedSafeCount: 59,
          expectedPlanFingerprint: "abc",
          confirm: null,
        },
        actualSafeCount: 59,
        actualPlanFingerprint: "abc",
      }).ok,
    ).toBe(false);

    expect(
      validateBackfillExecutionGates({
        gates: {
          execute: true,
          tenantKey: TENANT_KEY,
          expectedSafeCount: 59,
          expectedPlanFingerprint: "abc",
          confirm: "WRONG",
        },
        actualSafeCount: 59,
        actualPlanFingerprint: "abc",
      }).ok,
    ).toBe(false);
  });
});

describe("sample generation", () => {
  it("T. sample generation -> local file only / no storage or DB write", async () => {
    const plan = await buildPlan([
      makeRow({
        id: "sample-1",
        name: "AC Rossoneri",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 101 }],
      }),
      makeRow({
        id: "sample-2",
        name: "FC Aesch",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 102 }],
      }),
    ]);

    const outputDirectory = await mkdtemp(join(tmpdir(), "media-logo-01d3-test-"));
    const report = await generateProviderLogoSamplePreviews({
      candidates: plan.candidates,
      outputDirectory,
      additionalLimit: 0,
    });

    expect(assertSampleGenerationPerformsZeroPersistence()).toEqual({
      databaseMutation: false,
      blobWrite: false,
      providerRequest: false,
      providerSync: false,
    });
    expect(report.generatedCount).toBeGreaterThan(0);
    expect(report.outputDirectory).toBe(outputDirectory);

    const first = report.generated.find((entry) => entry.outputPath !== null);
    expect(first?.outputPath).toBeTruthy();
    const bytes = await readFile(first!.outputPath!);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("selects default representative club names when present", async () => {
    const candidates = [
      makeSafeCandidate({ externalClubId: "1", clubName: "AC Rossoneri" }),
      makeSafeCandidate({ externalClubId: "2", clubName: "FC Aesch" }),
      makeSafeCandidate({ externalClubId: "3", clubName: "Other Club" }),
    ];

    const selected = selectRepresentativeSampleCandidates(candidates, undefined, 1);
    expect(selected.map((entry) => entry.clubName)).toEqual([
      "AC Rossoneri",
      "FC Aesch",
      "Other Club",
    ]);
  });

  it("generateProviderLogoSamplePreview skips malformed sources", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "media-logo-01d3-skip-"));
    const result = await generateProviderLogoSamplePreview({
      candidate: makeSafeCandidate({
        externalClubId: "bad",
        clubName: "Bad Club",
        currentLogoUrl: "not-a-data-uri",
      }),
      outputDirectory,
    });

    expect(result.outputPath).toBeNull();
    expect(result.skippedReason).toBe("malformed_data_uri");
  });
});

describe("previewProviderLogoBackfillBatch", () => {
  it("dry-run preview performs zero uploads/writes", async () => {
    const plan = await buildPlan([
      makeRow({
        id: "preview",
        name: "Preview Club",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 55 }],
      }),
    ]);

    const preview = await previewProviderLogoBackfillBatch({ plan });
    expect(preview.dryRun).toBe(true);
    expect(preview.summary.blobUploads).toBe(0);
    expect(preview.summary.databaseUpdates).toBe(0);
    expect(preview.results.every((entry) => entry.outcome === "SKIPPED")).toBe(true);
  });
});

describe("computeBackfillPlanFingerprint", () => {
  it("is stable for identical safe candidate sets", async () => {
    const rows = [
      makeRow({
        id: "club-a",
        name: "Club A",
        logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        providerMappings: [{ provider: "SFV", providerClubId: 1 }],
      }),
    ];
    const planA = await buildPlan(rows);
    const planB = await buildPlan(rows);

    const fingerprintA = computeBackfillPlanFingerprint({
      tenantId: planA.tenantId,
      candidates: planA.candidates,
    });
    const fingerprintB = computeBackfillPlanFingerprint({
      tenantId: planB.tenantId,
      candidates: planB.candidates,
    });

    expect(fingerprintA).toBe(fingerprintB);
    expect(fingerprintA).toMatch(/^[a-f0-9]{64}$/);
  });
});
