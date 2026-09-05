/**
 * Pure route tests: authorization, runtime, deployment, and database checks
 * are mocked. No Prisma client, network service, or persistent state is used.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  evaluateRuntimeConfiguration: vi.fn(),
  checkDatabaseHealth: vi.fn(),
  getDeploymentMetadata: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/server/runtime", () => ({
  evaluateRuntimeConfiguration: mocks.evaluateRuntimeConfiguration,
  checkDatabaseHealth: mocks.checkDatabaseHealth,
}));

vi.mock("@/lib/server/deployment", () => ({
  getDeploymentMetadata: mocks.getDeploymentMetadata,
}));

const { GET } = await import("../route");

describe("GET /api/health/diag authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "sce-admin" } },
    });
    mocks.evaluateRuntimeConfiguration.mockReturnValue({
      ok: true,
      env: {
        hasDatabaseUrl: true,
        hasDirectUrl: true,
        hasNextAuthSecret: true,
        appBaseUrl: "https://sce.example",
        nextAuthUrl: "https://sce.example",
        appEnv: "stage",
        nodeEnv: "production",
        vercelEnv: "preview",
        isLocal: false,
        isStage: true,
        isProd: false,
      },
      warnings: [],
      errors: [],
    });
    mocks.checkDatabaseHealth.mockResolvedValue({
      ok: true,
      message: "Database connection successful.",
    });
    mocks.getDeploymentMetadata.mockReturnValue({
      environment: "stage",
      commitSha: "internal-sha",
    });
  });

  it("returns no diagnostic payload to an unauthenticated caller", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.evaluateRuntimeConfiguration).not.toHaveBeenCalled();
    expect(mocks.checkDatabaseHealth).not.toHaveBeenCalled();
    expect(mocks.getDeploymentMetadata).not.toHaveBeenCalled();
  });

  it("uses the established platform users.manage permission", async () => {
    await GET();

    expect(mocks.requireApiPermission).toHaveBeenCalledWith("users.manage");
  });

  it("retains diagnostics for an authorized SCE administrator", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.healthOk).toBe(true);
    expect(body.deployment.commitSha).toBe("internal-sha");
    expect(body.database.ok).toBe(true);
  });
});
