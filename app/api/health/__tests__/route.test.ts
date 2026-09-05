/**
 * Pure route tests: runtime and database checks are fully mocked.
 * No Prisma client, network service, or persistent state is used.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  evaluateRuntimeConfiguration: vi.fn(),
  checkDatabaseHealth: vi.fn(),
}));

vi.mock("@/lib/server/runtime", () => ({
  evaluateRuntimeConfiguration: mocks.evaluateRuntimeConfiguration,
  checkDatabaseHealth: mocks.checkDatabaseHealth,
}));

const { GET } = await import("../route");

function runtimeResult(ok: boolean) {
  return {
    ok,
    env: {
      hasDatabaseUrl: true,
      hasDirectUrl: true,
      hasNextAuthSecret: true,
      appBaseUrl: "https://sce.example",
      nextAuthUrl: "https://sce.example",
      appEnv: "prod",
      nodeEnv: "production",
      vercelEnv: "production",
      isLocal: false,
      isStage: false,
      isProd: true,
    },
    warnings: ["internal warning"],
    errors: ok ? [] : ["raw runtime failure"],
  };
}

describe("GET /api/health public contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateRuntimeConfiguration.mockReturnValue(runtimeResult(true));
    mocks.checkDatabaseHealth.mockResolvedValue({
      ok: true,
      message: "Database connection successful.",
    });
  });

  it("returns the minimal usable healthy response", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("does not disclose hostnames, secret presence, or deployment identifiers", async () => {
    mocks.checkDatabaseHealth.mockResolvedValue({
      ok: true,
      message: "Connected to db.internal.example:5432",
    });

    const response = await GET();
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toMatch(/db\.internal|databaseHost|hasNextAuthSecret/);
    expect(serialized).not.toMatch(/commitSha|deploymentId|vercelEnv/);
  });

  it("returns a generic 503 for unhealthy runtime and database state", async () => {
    mocks.evaluateRuntimeConfiguration.mockReturnValue(runtimeResult(false));
    mocks.checkDatabaseHealth.mockResolvedValue({
      ok: false,
      message:
        "Connection refused at db.internal.example:5432 password=top-secret",
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error" });
  });

  it("returns a generic 503 when a health dependency throws", async () => {
    mocks.checkDatabaseHealth.mockRejectedValue(
      new Error("Prisma P1001 at db.internal.example"),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error" });
  });
});
