/**
 * Tests for MEDIA-LOGO-01G4 temporary operational routes.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  MEDIA_LOGO_01G4_FROZEN_CONTRACT,
  type MediaLogoExecuteResult,
  type MediaLogoPreflightResult,
} from "@/lib/assets/media-logo-backfill-operation";

const mockRequireMediaLogoBackfillApiAccess = vi.fn();
vi.mock("@/lib/assets/media-logo-backfill-operation-auth", () => ({
  requireMediaLogoBackfillApiAccess: (...args: unknown[]) =>
    mockRequireMediaLogoBackfillApiAccess(...args),
}));

const mockRunMediaLogoBackfillPreflight = vi.fn();
const mockRunMediaLogoBackfillExecute = vi.fn();
vi.mock("@/lib/assets/media-logo-backfill-operation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/assets/media-logo-backfill-operation")>();
  return {
    ...actual,
    runMediaLogoBackfillPreflight: (...args: unknown[]) =>
      mockRunMediaLogoBackfillPreflight(...args),
    runMediaLogoBackfillExecute: (...args: unknown[]) =>
      mockRunMediaLogoBackfillExecute(...args),
  };
});

const preflightRoute = await import("../preflight/route");
const executeRoute = await import("../execute/route");

const PREFLIGHT_PATH = "http://x/api/ops/media-logo-backfill/preflight";
const EXECUTE_PATH = "http://x/api/ops/media-logo-backfill/execute";

const READY_PREFLIGHT: MediaLogoPreflightResult = {
  status: "READY",
  environment: {
    tenantKey: "fc-allschwil",
    appEnv: "stage",
    vercelEnv: "preview",
    isStageDatabase: true,
    isVercelRuntime: true,
    databaseUrl: "PRESENT",
    databaseHost: "postgresql://user:***@ep-stage.example/db",
    blobCapability: "PRESENT",
  },
  contract: {
    ok: true,
    status: "READY",
    reasons: [],
    planFingerprint: MEDIA_LOGO_01G4_FROZEN_CONTRACT.expectedFingerprint,
    quality: {
      safeToBackfill: 54,
      qualityPass: 54,
      qualityReviewRequired: 0,
      failedBackgroundRemoval: 0,
      failedNormalization: 0,
    },
    targetCollisions: 0,
    providerIdentityCollisions: 0,
    manualProtected: 10,
    blocked: 16,
    fcAllschwilVerified: true,
  },
  display: {
    tenantLabel: "FC Allschwil",
    eligible: 54,
    qualityPass: 54,
    planFingerprint: "00228828...238be6",
    manualProtected: 10,
    blocked: 16,
  },
};

const BLOCKED_PREFLIGHT: MediaLogoPreflightResult = {
  ...READY_PREFLIGHT,
  status: "BLOCKED",
  contract: {
    ...READY_PREFLIGHT.contract,
    ok: false,
    status: "BLOCKED",
    reasons: ["plan_fingerprint_mismatch"],
  },
};

function authorizedAccess() {
  return {
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: "user-1",
        activeTenantId: "tenant-fc-allschwil",
      },
    },
    tenant: {
      id: "tenant-fc-allschwil",
      key: "fc-allschwil",
    },
  };
}

function makeExecuteRequest(body: Record<string, unknown>) {
  return new NextRequest(EXECUTE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMediaLogoBackfillApiAccess.mockResolvedValue(authorizedAccess());
  mockRunMediaLogoBackfillPreflight.mockResolvedValue(READY_PREFLIGHT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("route module shape", () => {
  it("preflight exports only GET", () => {
    expect(typeof preflightRoute.GET).toBe("function");
    expect((preflightRoute as Record<string, unknown>).POST).toBeUndefined();
  });

  it("execute exports only POST", () => {
    expect(typeof executeRoute.POST).toBe("function");
    expect((executeRoute as Record<string, unknown>).GET).toBeUndefined();
  });

  it("routes include TEMPORARY MEDIA-LOGO-01 source comments", () => {
    const preflightSource = readFileSync(
      resolve(process.cwd(), "app/api/ops/media-logo-backfill/preflight/route.ts"),
      "utf-8",
    );
    const executeSource = readFileSync(
      resolve(process.cwd(), "app/api/ops/media-logo-backfill/execute/route.ts"),
      "utf-8",
    );

    expect(preflightSource).toContain("TEMPORARY MEDIA-LOGO-01G4 operational route");
    expect(executeSource).toContain("TEMPORARY MEDIA-LOGO-01G4 operational route");
  });
});

describe("GET /api/ops/media-logo-backfill/preflight", () => {
  it("A. unauthenticated requests are blocked", async () => {
    mockRequireMediaLogoBackfillApiAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await preflightRoute.GET();
    expect(response.status).toBe(401);
    expect(mockRunMediaLogoBackfillPreflight).not.toHaveBeenCalled();
  });

  it("B. unauthorized requests are blocked", async () => {
    mockRequireMediaLogoBackfillApiAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-1" } },
    });

    const response = await preflightRoute.GET();
    expect(response.status).toBe(403);
    expect(mockRunMediaLogoBackfillPreflight).not.toHaveBeenCalled();
  });

  it("F. returns BLOCKED when contract validation fails", async () => {
    mockRunMediaLogoBackfillPreflight.mockResolvedValue(BLOCKED_PREFLIGHT);

    const response = await preflightRoute.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("BLOCKED");
    expect(body.contract.reasons).toContain("plan_fingerprint_mismatch");
  });

  it("R. response contains no secrets", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "super-secret-blob-token";
    process.env.DATABASE_URL = "postgresql://user:secret@ep-stage.example/db";

    const response = await preflightRoute.GET();
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("super-secret-blob-token");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("BLOB_READ_WRITE_TOKEN");
    expect(serialized).not.toContain("DATABASE_URL");
  });
});

describe("POST /api/ops/media-logo-backfill/execute", () => {
  const executedResult: MediaLogoExecuteResult = {
    status: "EXECUTED",
    mutationStarted: true,
    environment: READY_PREFLIGHT.environment,
    contract: READY_PREFLIGHT.contract,
    execution: {
      attempted: 54,
      successful: 54,
      skipped: 0,
      failedNormalization: 0,
      failedQuality: 0,
      failedUpload: 0,
      failedDbUpdate: 0,
      partialFailures: 0,
    },
    postVerification: {
      remainingSafeToBackfill: 0,
      canonicalBlobUrls: ["https://abc.public.blob.vercel-storage.com/clubs/fc-allschwil/provider/sfv/1000.png"],
      manualProtected: 10,
      fcAllschwilUnchanged: true,
    },
    gateReason: null,
  };

  it("A. unauthenticated execute is blocked", async () => {
    mockRequireMediaLogoBackfillApiAccess.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await executeRoute.POST(
      makeExecuteRequest({ confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase }),
    );

    expect(response.status).toBe(401);
    expect(mockRunMediaLogoBackfillExecute).not.toHaveBeenCalled();
  });

  it("C. wrong tenant access is blocked via auth helper", async () => {
    mockRequireMediaLogoBackfillApiAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-1", activeTenantId: "other-tenant" } },
    });

    const response = await executeRoute.POST(
      makeExecuteRequest({ confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase }),
    );

    expect(response.status).toBe(403);
    expect(mockRunMediaLogoBackfillExecute).not.toHaveBeenCalled();
  });

  it("K. missing confirmation performs zero mutation", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue({
      status: "BLOCKED",
      mutationStarted: false,
      environment: READY_PREFLIGHT.environment,
      contract: READY_PREFLIGHT.contract,
      execution: null,
      postVerification: null,
      gateReason: "missing_or_invalid_confirmation",
    });

    const response = await executeRoute.POST(makeExecuteRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.mutationStarted).toBe(false);
    expect(body.execution).toBeNull();
  });

  it("L. wrong confirmation performs zero mutation", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue({
      status: "BLOCKED",
      mutationStarted: false,
      environment: READY_PREFLIGHT.environment,
      contract: READY_PREFLIGHT.contract,
      execution: null,
      postVerification: null,
      gateReason: "missing_or_invalid_confirmation",
    });

    const response = await executeRoute.POST(makeExecuteRequest({ confirmationPhrase: "WRONG" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.mutationStarted).toBe(false);
  });

  it("M. valid confirmation delegates to existing operation executor", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue(executedResult);

    const response = await executeRoute.POST(
      makeExecuteRequest({
        confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("EXECUTED");
    expect(mockRunMediaLogoBackfillExecute).toHaveBeenCalledWith({
      prisma: expect.anything(),
      confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    });
  });

  it("N. browser-supplied counts and fingerprint are ignored by route", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue(executedResult);

    await executeRoute.POST(
      makeExecuteRequest({
        confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
        expectedEligible: 1,
        expectedFingerprint: "browser-fingerprint",
      }),
    );

    expect(mockRunMediaLogoBackfillExecute).toHaveBeenCalledWith({
      prisma: expect.anything(),
      confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
    });
  });

  it("G. contract mismatch returns BLOCKED without mutation", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue({
      status: "BLOCKED",
      mutationStarted: false,
      environment: READY_PREFLIGHT.environment,
      contract: BLOCKED_PREFLIGHT.contract,
      execution: null,
      postVerification: null,
      gateReason: "plan_fingerprint_mismatch",
    });

    const response = await executeRoute.POST(
      makeExecuteRequest({
        confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.status).toBe("BLOCKED");
    expect(body.mutationStarted).toBe(false);
  });

  it("S. second execution becomes idempotent no-op", async () => {
    mockRunMediaLogoBackfillExecute.mockResolvedValue({
      status: "NO_OP",
      mutationStarted: false,
      environment: READY_PREFLIGHT.environment,
      contract: {
        ...READY_PREFLIGHT.contract,
        ok: false,
        status: "BLOCKED",
        reasons: ["safe_to_backfill_count_mismatch"],
        quality: {
          ...READY_PREFLIGHT.contract.quality,
          safeToBackfill: 0,
          qualityPass: 0,
        },
      },
      execution: {
        attempted: 0,
        successful: 0,
        skipped: 0,
        failedNormalization: 0,
        failedQuality: 0,
        failedUpload: 0,
        failedDbUpdate: 0,
        partialFailures: 0,
      },
      postVerification: {
        remainingSafeToBackfill: 0,
        canonicalBlobUrls: [],
        manualProtected: 10,
        fcAllschwilUnchanged: true,
      },
      gateReason: "safe_to_backfill_count_mismatch",
    });

    const response = await executeRoute.POST(
      makeExecuteRequest({
        confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
      }),
    );
    const body = await response.json();

    expect(body.status).toBe("NO_OP");
    expect(body.postVerification.remainingSafeToBackfill).toBe(0);
  });

  it("R. execute response contains no secrets", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "super-secret-blob-token";
    process.env.DATABASE_URL = "postgresql://user:secret@ep-stage.example/db";
    mockRunMediaLogoBackfillExecute.mockResolvedValue(executedResult);

    const response = await executeRoute.POST(
      makeExecuteRequest({
        confirmationPhrase: MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase,
      }),
    );
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("super-secret-blob-token");
    expect(serialized).not.toContain("secret");
  });
});

describe("auth helper contract", () => {
  it("C. route auth module enforces fc-allschwil tenant key", async () => {
    const authSource = readFileSync(
      resolve(process.cwd(), "lib/assets/media-logo-backfill-operation-auth.ts"),
      "utf-8",
    );

    expect(authSource).toContain('key !== MEDIA_LOGO_BACKFILL_TENANT_KEY');
    expect(authSource).toContain("PERMISSIONS.WEBSITE_MANAGE");
    expect(authSource).not.toContain("PERMISSIONS.TENANTS_MANAGE");
    expect(authSource).toContain("isMediaLogoBackfillAuthEnvironmentAllowed");
  });
});

describe("mutation scope", () => {
  it("P/Q. operation service only updates ExternalClub.logoUrl through executor dependencies", async () => {
    const operationSource = readFileSync(
      resolve(process.cwd(), "lib/assets/media-logo-backfill-operation.ts"),
      "utf-8",
    );

    expect(operationSource).toContain("externalClub.updateMany");
    expect(operationSource).not.toContain("externalTeam");
    expect(operationSource).not.toContain("externalClubProviderMapping");
    expect(operationSource).not.toContain("externalTeamProviderMapping");
    expect(operationSource).toContain("executeProviderLogoBackfillBatch");
  });
});
