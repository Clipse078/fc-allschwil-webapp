/**
 * MEDIA-LOGO-01G7 — route authorization integration tests (real auth helper).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { MEDIA_LOGO_01G4_FROZEN_CONTRACT } from "@/lib/assets/media-logo-backfill-operation-contract";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getCurrentTenantContextById: vi.fn(),
  runMediaLogoBackfillPreflight: vi.fn(),
  runMediaLogoBackfillExecute: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: (...args: unknown[]) => mocks.requireApiPermission(...args),
}));

vi.mock("@/lib/tenants/context", () => ({
  getCurrentTenantContextById: (...args: unknown[]) => mocks.getCurrentTenantContextById(...args),
}));

vi.mock("@/lib/assets/media-logo-backfill-operation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/assets/media-logo-backfill-operation")>();
  return {
    ...actual,
    runMediaLogoBackfillPreflight: (...args: unknown[]) =>
      mocks.runMediaLogoBackfillPreflight(...args),
    runMediaLogoBackfillExecute: (...args: unknown[]) =>
      mocks.runMediaLogoBackfillExecute(...args),
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

const ORIGINAL_ENV = { ...process.env };

const FC_ALLSCHWIL_TENANT = {
  id: "tenant-fc-allschwil",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
};

const READY_PREFLIGHT = {
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

function authorizedApiAccess() {
  return {
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: "user-michael",
        activeTenantId: FC_ALLSCHWIL_TENANT.id,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "stage";
  mocks.requireApiPermission.mockResolvedValue(authorizedApiAccess());
  mocks.getCurrentTenantContextById.mockResolvedValue(FC_ALLSCHWIL_TENANT);
  mocks.runMediaLogoBackfillPreflight.mockResolvedValue(READY_PREFLIGHT);
  mocks.runMediaLogoBackfillExecute.mockResolvedValue({
    status: "BLOCKED",
    mutationStarted: false,
    environment: READY_PREFLIGHT.environment,
    contract: READY_PREFLIGHT.contract,
    execution: null,
    postVerification: null,
    gateReason: "missing_or_invalid_confirmation",
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("route authorization with real auth helper", () => {
  it("2. fc-allschwil WEBSITE_MANAGE user can access GET preflight", async () => {
    const preflightRoute = await import("../preflight/route");
    const response = await preflightRoute.GET();

    expect(response.status).toBe(200);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.WEBSITE_MANAGE);
    expect(mocks.runMediaLogoBackfillPreflight).toHaveBeenCalled();
  });

  it("3. fc-allschwil WEBSITE_MANAGE user passes POST execute authorization without mutation", async () => {
    const executeRoute = await import("../execute/route");
    const response = await executeRoute.POST(
      new NextRequest("http://x/api/ops/media-logo-backfill/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.WEBSITE_MANAGE);
    expect(body.mutationStarted).toBe(false);
    expect(mocks.runMediaLogoBackfillExecute).toHaveBeenCalled();
  });
});
