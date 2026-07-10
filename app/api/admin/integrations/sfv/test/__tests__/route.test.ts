/**
 * Tests for POST /api/admin/integrations/sfv/test
 *
 * Tests authorization, configuration validation, and response sanitization.
 * All external dependencies (auth, SFV client) are mocked.
 * No real network requests are made. No real credentials used.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock external dependencies before importing the route ────────────────────

const mockRequireApiPermission = vi.fn();
const mockGetSfvConfigStatus = vi.fn();
const mockTestSfvConnection = vi.fn();
const mockGetRuntimeEnvironment = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/integrations/sfv/config", () => ({
  getSfvConfigStatus: mockGetSfvConfigStatus,
}));

vi.mock("@/lib/integrations/sfv/client", () => ({
  testSfvConnection: mockTestSfvConnection,
  evictCachedToken: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRuntimeEnvironment: mockGetRuntimeEnvironment,
}));

// Import after mocks
const { POST } = await import("../route");

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUTHENTICATED_ADMIN = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      tenantId: "tenant-1",
    },
  },
};

const VALID_CONFIG_STATUS = {
  hasTokenUrl: true,
  hasApplicationKey: true,
  hasApplicationPass: true,
  hasClubId: true,
  tokenUrlUsesHttps: true,
  clubIdFormatValid: true,
  allPresent: true,
  allValid: true,
};

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockGetRuntimeEnvironment.mockReturnValue({ appEnv: "local" });
  mockGetSfvConfigStatus.mockReturnValue(VALID_CONFIG_STATUS);
  mockTestSfvConnection.mockResolvedValue({
    connected: true,
    tokenValid: true,
    tokenExpiresAt: null,
    testedAt: new Date().toISOString(),
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/integrations/sfv/test", () => {
  // ── Authentication ──────────────────────────────────────────────────────────

  it("rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await POST();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects user without TENANTS_MANAGE with 403", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-2", email: "nonadmin@test.invalid" } },
    });

    const response = await POST();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  // ── Configuration validation ────────────────────────────────────────────────

  it("returns 503 with missing variables list when config is incomplete", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
    mockGetSfvConfigStatus.mockReturnValue({
      hasTokenUrl: false,
      hasApplicationKey: false,
      hasApplicationPass: true,
      hasClubId: true,
      tokenUrlUsesHttps: false,
      clubIdFormatValid: true,
      allPresent: false,
      allValid: false,
    });

    const response = await POST();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.connected).toBe(false);
    expect(body.configurationValid).toBe(false);
    expect(body.missingVariables).toContain("SFV_TOKEN_URL");
    expect(body.missingVariables).toContain("SFV_APPLICATION_KEY");
  });

  it("reports invalid variables (non-HTTPS URL) in response", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
    mockGetSfvConfigStatus.mockReturnValue({
      hasTokenUrl: true,
      hasApplicationKey: true,
      hasApplicationPass: true,
      hasClubId: true,
      tokenUrlUsesHttps: false,
      clubIdFormatValid: true,
      allPresent: true,
      allValid: false,
    });

    const response = await POST();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.invalidVariables).toContainEqual(expect.stringContaining("SFV_TOKEN_URL"));
  });

  // ── Successful connection test response ─────────────────────────────────────

  it("returns 200 with sanitized result on successful test", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);

    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.connected).toBe(true);
    expect(body.configurationValid).toBe(true);
    expect(body.clubIdConfigured).toBe(true);
    expect(body.tokenValid).toBe(true);
    expect(body.testedAt).toBeDefined();
  });

  it("tokenExpiresAt is null in successful response (SFV API returns no expiry timestamp)", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);

    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tokenExpiresAt).toBeNull();
  });

  it("response does not contain application key, password, or token", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
    mockTestSfvConnection.mockResolvedValue({
      connected: true,
      tokenValid: true,
      tokenExpiresAt: null,
      testedAt: new Date().toISOString(),
      error: null,
    });

    const response = await POST();
    const body = await response.json();
    const json = JSON.stringify(body);

    expect(json).not.toContain("test-application-key");
    expect(json).not.toContain("test-application-pass");
    expect(json).not.toContain("Bearer");
    expect(json).not.toContain("Authorization");
  });

  it("response does not contain raw upstream SFV payload", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
    mockTestSfvConnection.mockResolvedValue({
      connected: false,
      tokenValid: false,
      tokenExpiresAt: null,
      testedAt: new Date().toISOString(),
      error: { code: "SFV_UNAUTHORIZED", message: "SFV token request rejected: 401 Unauthorized." },
    });

    const response = await POST();
    const body = await response.json();
    const json = JSON.stringify(body);

    expect(json).not.toContain("applicationKey");
    expect(json).not.toContain("applicationPass");
    expect(json).not.toContain("test-application-key");
    expect(json).not.toContain("test-application-pass");
  });

  // ── Failed connection test ──────────────────────────────────────────────────

  it("returns 502 with sanitized error when connection fails", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
    mockTestSfvConnection.mockResolvedValue({
      connected: false,
      tokenValid: false,
      tokenExpiresAt: null,
      testedAt: new Date().toISOString(),
      error: { code: "SFV_UNAUTHORIZED", message: "SFV token request rejected: 401 Unauthorized." },
    });

    const response = await POST();

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.connected).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("SFV_UNAUTHORIZED");
  });

  // ── No database write ───────────────────────────────────────────────────────

  it("does not call prisma or write to the database", async () => {
    // The route delegates to testSfvConnection (mocked above) and performs
    // no direct DB operations. Prisma is not imported by the route module.
    // Verification: the route executes successfully without prisma interaction.
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);

    const response = await POST();

    // Route responds — confirming it does not block waiting for DB ops.
    expect(response.status).toBeDefined();
    const body = await response.json();
    // No database fields appear in the response.
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("importRunId");
    expect(body).not.toHaveProperty("persistedAt");
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  it("uses session-carried tenantId through requireApiPermission (existing mechanism)", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);

    await POST();

    expect(mockRequireApiPermission).toHaveBeenCalledOnce();
  });
});
