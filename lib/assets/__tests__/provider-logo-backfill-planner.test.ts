/**
 * MEDIA-LOGO-01D2 — provider logo backfill dry-run planner tests.
 */

import { describe, expect, it } from "vitest";

import {
  assertDryRunPerformsZeroPersistence,
  assessBackfillSafety,
  classifyExternalClubLogoSelection,
  decodeProviderLogoDataUri,
  dryRunNormalizeProviderLogoSource,
  isManualProtectedClubLogo,
  planProviderLogoBackfill,
  resolveProviderClubIdentity,
  type ExternalClubLogoBackfillRow,
} from "../provider-logo-backfill-planner";

const TENANT_KEY = "fc-allschwil";

/** Minimal valid 1x1 transparent GIF. */
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Minimal valid 1x1 PNG. */
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

describe("decodeProviderLogoDataUri", () => {
  it("decodes GIF data URI", () => {
    const decoded = decodeProviderLogoDataUri(`data:image/gif;base64,${GIF_BASE64}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.declaredMime).toBe("image/gif");
    expect(decoded?.buffer.length).toBeGreaterThan(0);
  });

  it("decodes JPEG data URI", () => {
    const jpeg =
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const decoded = decodeProviderLogoDataUri(`data:image/jpeg;base64,${jpeg}`);
    expect(decoded).not.toBeNull();
  });

  it("decodes PNG data URI", () => {
    const decoded = decodeProviderLogoDataUri(`data:image/png;base64,${PNG_BASE64}`);
    expect(decoded).not.toBeNull();
  });

  it("returns null for malformed data URI", () => {
    expect(decodeProviderLogoDataUri("data:image/png;charset=utf-8,%%%")).toBeNull();
    expect(decodeProviderLogoDataUri("not-a-data-uri")).toBeNull();
  });
});

describe("isManualProtectedClubLogo", () => {
  it("protects SCE-managed blob crest paths", () => {
    const clubId = "club-abc";
    const url = `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/${clubId}.png`;
    expect(isManualProtectedClubLogo(url, TENANT_KEY, clubId)).toBe(true);
  });

  it("does not treat provider-normalized blob paths as manual", () => {
    const url = `https://abc.public.blob.vercel-storage.com/clubs/${TENANT_KEY}/provider/sfv/483.png`;
    expect(isManualProtectedClubLogo(url, TENANT_KEY, "club-abc")).toBe(false);
  });

  it("does not treat provider data URIs as manual", () => {
    expect(
      isManualProtectedClubLogo(`data:image/gif;base64,${GIF_BASE64}`, TENANT_KEY, "club-abc"),
    ).toBe(false);
  });
});

describe("classifyExternalClubLogoSelection", () => {
  it("excludes archived clubs from active normalization scope", () => {
    expect(
      classifyExternalClubLogoSelection(
        makeRow({
          id: "archived",
          name: "Archived Club",
          archivedAt: new Date(),
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        }),
      ),
    ).toBe("ARCHIVED");
  });

  it("classifies provider GIF/JPEG sources for normalization", () => {
    expect(
      classifyExternalClubLogoSelection(
        makeRow({
          id: "gif",
          name: "GIF Club",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        }),
      ),
    ).toBe("NORMALIZE_PROVIDER_SOURCE");
  });

  it("classifies already-normalized PNG data URIs separately", () => {
    expect(
      classifyExternalClubLogoSelection(
        makeRow({
          id: "png",
          name: "PNG Club",
          logoUrl: `data:image/png;base64,${PNG_BASE64}`,
        }),
      ),
    ).toBe("ALREADY_NORMALIZED_DATA_URI");
  });
});

describe("resolveProviderClubIdentity", () => {
  it("marks provider ID ready when mapping exists", () => {
    const identity = resolveProviderClubIdentity(TENANT_KEY, [
      { provider: "SFV", providerClubId: 483 },
    ]);
    expect(identity.status).toBe("PROVIDER_ID_READY");
    expect(identity.targetStorageKey).toBe("clubs/fc-allschwil/provider/sfv/483.png");
  });

  it("marks mapping missing when no provider mapping exists", () => {
    const identity = resolveProviderClubIdentity(TENANT_KEY, []);
    expect(identity.status).toBe("PROVIDER_MAPPING_MISSING");
    expect(identity.targetStorageKey).toBeNull();
  });

  it("marks ambiguous when multiple provider IDs are linked", () => {
    const identity = resolveProviderClubIdentity(TENANT_KEY, [
      { provider: "SFV", providerClubId: 1 },
      { provider: "SFV", providerClubId: 2 },
    ]);
    expect(identity.status).toBe("PROVIDER_ID_AMBIGUOUS");
  });
});

describe("dryRunNormalizeProviderLogoSource", () => {
  it("normalizes GIF bytes in memory without persistence", async () => {
    const result = await dryRunNormalizeProviderLogoSource(Buffer.from(GIF_BASE64, "base64"));
    expect(result.succeeded).toBe(true);
    expect(result.sourceFormat).toBe("image/gif");
    expect(result.outputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(assertDryRunPerformsZeroPersistence().blobWrite).toBe(false);
  });

  it("reports normalization failure for invalid bytes", async () => {
    const result = await dryRunNormalizeProviderLogoSource(Buffer.from("not-an-image"));
    expect(result.succeeded).toBe(false);
    expect(result.failureReason).toBe("normalization_failed");
  });
});

describe("assessBackfillSafety", () => {
  it("returns NO_CHANGE for manual protected logos", () => {
    expect(
      assessBackfillSafety({
        selectionCategory: "MANUAL_PROTECTED",
        manualProtected: true,
        providerIdentity: resolveProviderClubIdentity(TENANT_KEY, [
          { provider: "SFV", providerClubId: 1 },
        ]),
        collisionStatus: "NO_COLLISION",
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
        },
      }),
    ).toBe("NO_CHANGE");
  });

  it("requires review when provider mapping is missing", () => {
    expect(
      assessBackfillSafety({
        selectionCategory: "NORMALIZE_PROVIDER_SOURCE",
        manualProtected: false,
        providerIdentity: resolveProviderClubIdentity(TENANT_KEY, []),
        collisionStatus: "NO_COLLISION",
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
          sourceFingerprint: "abc",
          outputFingerprint: "def",
          backgroundCleanup: "NO_CLEANUP_REQUIRED",
          opaquePixelRatio: 1,
          failureReason: null,
        },
      }),
    ).toBe("REVIEW_REQUIRED");
  });
});

describe("planProviderLogoBackfill", () => {
  it("detects duplicate provider ID collisions", async () => {
    const plan = await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "club-a",
          name: "Club A",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
          providerMappings: [{ provider: "SFV", providerClubId: 99 }],
        }),
        makeRow({
          id: "club-b",
          name: "Club B",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
          providerMappings: [{ provider: "SFV", providerClubId: 99 }],
        }),
      ],
    });

    expect(plan.collisions.some((entry) => entry.kind === "SAME_PROVIDER_ID_DUPLICATE")).toBe(
      true,
    );
    expect(plan.summary.reviewRequired).toBeGreaterThan(0);
  });

  it("blocks candidates with missing provider mapping", async () => {
    const plan = await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "club-no-map",
          name: "No Mapping",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
        }),
      ],
    });

    expect(plan.candidates[0]?.safetyClassification).toBe("REVIEW_REQUIRED");
    expect(plan.candidates[0]?.blockedReason).toBe("PROVIDER_MAPPING_MISSING");
  });

  it("keeps already-normalized PNG clubs out of primary mutation count", async () => {
    const plan = await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "png-club",
          name: "PNG Club",
          logoUrl: `data:image/png;base64,${PNG_BASE64}`,
          providerMappings: [{ provider: "SFV", providerClubId: 12 }],
        }),
      ],
    });

    expect(plan.summary.rowsWouldChange).toBe(0);
    expect(plan.summary.alreadyNormalized).toBe(1);
    expect(plan.candidates[0]?.safetyClassification).toBe("NO_CHANGE");
  });

  it("plans SAFE_TO_BACKFILL for valid mapped GIF sources", async () => {
    const plan = await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "gif-club",
          name: "GIF Club",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
          providerMappings: [{ provider: "SFV", providerClubId: 483 }],
        }),
      ],
    });

    expect(plan.candidates[0]?.safetyClassification).toBe("SAFE_TO_BACKFILL");
    expect(plan.candidates[0]?.plannedLogoUrl).toContain(
      "clubs/fc-allschwil/provider/sfv/483.png",
    );
    expect(plan.summary.blobUploadsWouldOccur).toBe(1);
    expect(plan.summary.databaseUpdatesWouldOccur).toBe(1);
  });

  it("flags suspicious empty output", async () => {
    const plan = await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "bad",
          name: "Bad Club",
          logoUrl: "data:image/gif;base64,AAAA",
          providerMappings: [{ provider: "SFV", providerClubId: 5 }],
        }),
      ],
    });

    expect(
      plan.candidates[0]?.safetyClassification === "FAILED_NORMALIZATION" ||
        plan.candidates[0]?.safetyClassification === "REVIEW_REQUIRED",
    ).toBe(true);
  });

  it("performs zero persistence", async () => {
    await planProviderLogoBackfill({
      tenantKey: TENANT_KEY,
      tenantId: "tenant-1",
      rows: [
        makeRow({
          id: "club",
          name: "Club",
          logoUrl: `data:image/gif;base64,${GIF_BASE64}`,
          providerMappings: [{ provider: "SFV", providerClubId: 1 }],
        }),
      ],
    });

    expect(assertDryRunPerformsZeroPersistence()).toEqual({
      databaseMutation: false,
      blobWrite: false,
      providerRequest: false,
      providerSync: false,
    });
  });
});
