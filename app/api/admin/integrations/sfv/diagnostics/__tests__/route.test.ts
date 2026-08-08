/**
 * Tests for POST /api/admin/integrations/sfv/diagnostics
 *
 * Contract (this slice):
 *   - clubId is removed from the API contract. Requests containing clubId are rejected.
 *   - clubId is always resolved from tenant SFV configuration, never from the request.
 *   - tenantId is never accepted from the request — always from the authenticated session.
 *   - seasonId defaults to config.defaultSeasonId; an explicit positive-integer override
 *     may be supplied in the body.
 *   - Disabled integration → 409. Missing configuration → 404.
 *
 * Architecture invariants verified:
 *   - Prisma is never imported (all persistence goes through the service layer).
 *   - tenant-config-repository is never imported directly.
 *   - The route imports only requireApiPermission, the diagnostics service, and
 *     the tenant-config-service.
 *
 * All external dependencies are mocked. No real network requests. No real credentials.
 * No real database access.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  SfvAdminDiagnostics,
  SfvDiagnosticIssue,
} from "@/lib/integrations/sfv/admin-diagnostics-service";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiPermission = vi.fn();
const mockRunSfvAdminDiagnostics = vi.fn();
const mockRequireEnabledSfvConfigForTenant = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/integrations/sfv/admin-diagnostics-service", () => ({
  runSfvAdminDiagnostics: mockRunSfvAdminDiagnostics,
}));

vi.mock("@/lib/integrations/sfv/tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: mockRequireEnabledSfvConfigForTenant,
}));

// Import after mocks
const { POST } = await import("../route");

// ── Request factory helpers ───────────────────────────────────────────────────

const ROUTE_URL = "http://localhost/api/admin/integrations/sfv/diagnostics";

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

function makeEmptyRequest(): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
  });
}

// ── Auth fixture helpers ──────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc-123";
const CLUB_ID = 483;
const DEFAULT_SEASON_ID = 2027;

const AUTHENTICATED_ADMIN = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      activeTenantId: TENANT_ID,
    },
  },
};

const AUTHENTICATED_ADMIN_NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      activeTenantId: null,
    },
  },
};

const UNAUTHENTICATED = {
  ok: false as const,
  status: 401,
  error: "Unauthorized",
  session: null,
};

const FORBIDDEN = {
  ok: false as const,
  status: 403,
  error: "Forbidden",
  session: { user: { id: "user-2", email: "nonadmin@test.invalid" } },
};

// ── Tenant config fixture ─────────────────────────────────────────────────────

function makeConfig(overrides: Partial<TenantSfvConfig> = {}): TenantSfvConfig {
  return {
    id: "cfg-1",
    tenantId: TENANT_ID,
    clubId: CLUB_ID,
    defaultSeasonId: DEFAULT_SEASON_ID,
    organisationId: null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    lastCompetitionSyncAt: null,
    lastClubMasterImportAt: null,
    syncLockedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ── Diagnostics fixture helpers ───────────────────────────────────────────────

const BASE_COUNTS = {
  ownTeams: 11,
  scheduleRows: 60,
  rankingRows: 26,
  resolvedScheduleRows: 58,
  scheduleBothOwnRows: 0,
  scheduleNoOwnTeamRows: 0,
  scheduleInvalidRows: 0,
  scheduleFailedRows: 0,
  rankingOwnTeamRows: 11,
  rankingOpponentRows: 15,
  rankingInvalidRows: 0,
  rankingFailedRows: 0,
  uniqueOpponentTeams: 43,
  picturesRequested: 43,
  picturesPresent: 43,
  picturesMissing: 0,
  pictureFailures: 0,
};

const BASE_TIMINGS = [
  { stage: "resolve-common-ids" as const, durationMs: 120, success: true },
  { stage: "load-club-season-data" as const, durationMs: 880, success: true },
];

function makeHealthyDiagnostics(
  clubId = CLUB_ID,
  seasonId = DEFAULT_SEASON_ID,
): SfvAdminDiagnostics {
  return {
    health: "healthy",
    clubId,
    seasonId,
    seasonName: "2026/2027",
    seasonShortName: "26/27",
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 1000,
    timings: BASE_TIMINGS,
    counts: BASE_COUNTS,
    issues: [],
  };
}

function makeDegradedDiagnostics(
  clubId = CLUB_ID,
  seasonId = DEFAULT_SEASON_ID,
): SfvAdminDiagnostics {
  const degradedIssue: SfvDiagnosticIssue = {
    severity: "warning",
    code: "SFV_SCHEDULE_NO_OWN_TEAM",
    message: "2 schedule row(s) matched neither team as an own team.",
    count: 2,
  };
  return {
    health: "degraded",
    clubId,
    seasonId,
    seasonName: "2026/2027",
    seasonShortName: "26/27",
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 1000,
    timings: BASE_TIMINGS,
    counts: { ...BASE_COUNTS, scheduleNoOwnTeamRows: 2 },
    issues: [degradedIssue],
  };
}

function makeUnhealthyRetryableDiagnostics(
  clubId = CLUB_ID,
  seasonId = DEFAULT_SEASON_ID,
): SfvAdminDiagnostics {
  const retryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_TIMEOUT",
    message: "The SFV API request timed out.",
    retryable: true,
  };
  const emptyCounts = {
    ownTeams: 0,
    scheduleRows: 0,
    rankingRows: 0,
    resolvedScheduleRows: 0,
    scheduleBothOwnRows: 0,
    scheduleNoOwnTeamRows: 0,
    scheduleInvalidRows: 0,
    scheduleFailedRows: 0,
    rankingOwnTeamRows: 0,
    rankingOpponentRows: 0,
    rankingInvalidRows: 0,
    rankingFailedRows: 0,
    uniqueOpponentTeams: 0,
    picturesRequested: 0,
    picturesPresent: 0,
    picturesMissing: 0,
    pictureFailures: 0,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 30000,
    timings: [{ stage: "resolve-common-ids", durationMs: 30000, success: false }],
    counts: emptyCounts,
    issues: [retryableIssue],
  };
}

function makeUnhealthyNonRetryableDiagnostics(
  clubId = CLUB_ID,
  seasonId = DEFAULT_SEASON_ID,
): SfvAdminDiagnostics {
  const nonRetryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_AUTH_FAILURE",
    message: "SFV authentication failed.",
    retryable: false,
  };
  const emptyCounts = {
    ownTeams: 0,
    scheduleRows: 0,
    rankingRows: 0,
    resolvedScheduleRows: 0,
    scheduleBothOwnRows: 0,
    scheduleNoOwnTeamRows: 0,
    scheduleInvalidRows: 0,
    scheduleFailedRows: 0,
    rankingOwnTeamRows: 0,
    rankingOpponentRows: 0,
    rankingInvalidRows: 0,
    rankingFailedRows: 0,
    uniqueOpponentTeams: 0,
    picturesRequested: 0,
    picturesPresent: 0,
    picturesMissing: 0,
    pictureFailures: 0,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 200,
    timings: [{ stage: "resolve-common-ids", durationMs: 200, success: false }],
    counts: emptyCounts,
    issues: [nonRetryableIssue],
  };
}

function makeUnhealthyMixedDiagnostics(
  clubId = CLUB_ID,
  seasonId = DEFAULT_SEASON_ID,
): SfvAdminDiagnostics {
  const nonRetryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_AUTH_FAILURE",
    message: "SFV authentication failed.",
    retryable: false,
  };
  const retryableIssue: SfvDiagnosticIssue = {
    severity: "error",
    code: "SFV_TIMEOUT",
    message: "The SFV API request timed out.",
    retryable: true,
  };
  const emptyCounts = {
    ownTeams: 0,
    scheduleRows: 0,
    rankingRows: 0,
    resolvedScheduleRows: 0,
    scheduleBothOwnRows: 0,
    scheduleNoOwnTeamRows: 0,
    scheduleInvalidRows: 0,
    scheduleFailedRows: 0,
    rankingOwnTeamRows: 0,
    rankingOpponentRows: 0,
    rankingInvalidRows: 0,
    rankingFailedRows: 0,
    uniqueOpponentTeams: 0,
    picturesRequested: 0,
    picturesPresent: 0,
    picturesMissing: 0,
    pictureFailures: 0,
  };
  return {
    health: "unhealthy",
    clubId,
    seasonId,
    seasonName: null,
    seasonShortName: null,
    generatedAt: "2026-07-12T10:00:00.000Z",
    totalDurationMs: 500,
    timings: [{ stage: "resolve-common-ids", durationMs: 500, success: false }],
    counts: emptyCounts,
    issues: [nonRetryableIssue, retryableIssue],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
  mockRequireEnabledSfvConfigForTenant.mockResolvedValue(makeConfig());
  mockRunSfvAdminDiagnostics.mockResolvedValue(makeHealthyDiagnostics());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/integrations/sfv/diagnostics", () => {
  // ── Architecture invariants ─────────────────────────────────────────────────

  it("route module exports POST handler", () => {
    expect(typeof POST).toBe("function");
  });

  it("route file does not import Prisma client directly", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/integrations/sfv/diagnostics/route.ts"),
      "utf-8",
    );
    expect(content).not.toContain("@prisma/client");
    expect(content).not.toContain("prisma/client");
  });

  it("route file does not import any repository module directly", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/integrations/sfv/diagnostics/route.ts"),
      "utf-8",
    );
    expect(content).not.toContain("tenant-config-repository");
    expect(content).not.toContain("admin-diagnostics-repository");
    expect(content).not.toContain("-repository");
  });

  it("route file imports only service layer (not raw repositories or Prisma)", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/admin/integrations/sfv/diagnostics/route.ts"),
      "utf-8",
    );
    // Service layer imports are allowed
    expect(content).toContain("admin-diagnostics-service");
    expect(content).toContain("tenant-config-service");
    // Prisma and repository layers must not appear
    expect(content).not.toContain("@prisma");
    expect(content).not.toContain("-repository");
  });

  // ── Authentication and authorization ────────────────────────────────────────

  it("rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects unauthorized request with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("does not call requireEnabledSfvConfigForTenant when auth fails (unauthenticated)", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST(makeEmptyRequest());

    expect(mockRequireEnabledSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("does not call requireEnabledSfvConfigForTenant when auth fails (forbidden)", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await POST(makeEmptyRequest());

    expect(mockRequireEnabledSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when auth fails (unauthenticated)", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when auth fails (forbidden)", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("calls requireApiPermission with TENANTS_MANAGE", async () => {
    await POST(makeEmptyRequest());

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  // ── Tenant context resolution ───────────────────────────────────────────────

  it("returns 403 when tenantId is missing from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Tenant context");
  });

  it("does not call requireEnabledSfvConfigForTenant when tenantId missing from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    await POST(makeEmptyRequest());

    expect(mockRequireEnabledSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when tenantId missing from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("tenantId comes from session, not from request body", async () => {
    // Even if the caller tries to put tenantId in the body, it is ignored —
    // the session-derived tenantId is always used.
    await POST(makeJsonRequest({ tenantId: "attacker-tenant-id" }));

    expect(mockRequireEnabledSfvConfigForTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(mockRequireEnabledSfvConfigForTenant).not.toHaveBeenCalledWith(
      "attacker-tenant-id",
    );
  });

  it("requireEnabledSfvConfigForTenant is called with session-derived tenantId", async () => {
    await POST(makeEmptyRequest());

    expect(mockRequireEnabledSfvConfigForTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(mockRequireEnabledSfvConfigForTenant).toHaveBeenCalledOnce();
  });

  // ── Request body validation: clubId is forbidden ────────────────────────────

  it("rejects request body containing clubId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 483 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error).toContain("clubId");
  });

  it("error message for clubId in body explains it comes from configuration", async () => {
    const response = await POST(makeJsonRequest({ clubId: 483 }));

    const body = await response.json();
    expect(body.error.toLowerCase()).toContain("configuration");
  });

  it("does not call requireEnabledSfvConfigForTenant when clubId is in body", async () => {
    await POST(makeJsonRequest({ clubId: 483 }));

    expect(mockRequireEnabledSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when clubId is in body", async () => {
    await POST(makeJsonRequest({ clubId: 483 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("rejects request body containing both clubId and valid seasonId with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 483, seasonId: 2027 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("clubId");
  });

  it("rejects clubId=0 in body with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: 0 }));

    expect(response.status).toBe(400);
  });

  it("rejects clubId=-1 in body with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: -1 }));

    expect(response.status).toBe(400);
  });

  it("rejects string clubId in body with 400", async () => {
    const response = await POST(makeJsonRequest({ clubId: "483" }));

    expect(response.status).toBe(400);
  });

  // ── Request body validation: seasonId optional override ────────────────────

  it("accepts empty body and uses config.defaultSeasonId", async () => {
    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({
      clubId: CLUB_ID,
      seasonId: DEFAULT_SEASON_ID,
    });
  });

  it("accepts empty JSON object body and uses config.defaultSeasonId", async () => {
    const response = await POST(makeJsonRequest({}));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({
      clubId: CLUB_ID,
      seasonId: DEFAULT_SEASON_ID,
    });
  });

  it("accepts explicit seasonId override and passes it to diagnostics", async () => {
    const response = await POST(makeJsonRequest({ seasonId: 2028 }));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({
      clubId: CLUB_ID,
      seasonId: 2028,
    });
  });

  it("season override 1 (boundary: minimum positive integer) is accepted", async () => {
    const response = await POST(makeJsonRequest({ seasonId: 1 }));

    expect(response.status).toBe(200);
    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith({
      clubId: CLUB_ID,
      seasonId: 1,
    });
  });

  it("season override takes precedence over config.defaultSeasonId", async () => {
    const OVERRIDE = 2030;
    await POST(makeJsonRequest({ seasonId: OVERRIDE }));

    const callArg = mockRunSfvAdminDiagnostics.mock.calls[0][0];
    expect(callArg.seasonId).toBe(OVERRIDE);
    expect(callArg.seasonId).not.toBe(DEFAULT_SEASON_ID);
  });

  it("rejects seasonId=0 in body with 400", async () => {
    const response = await POST(makeJsonRequest({ seasonId: 0 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects negative seasonId in body with 400", async () => {
    const response = await POST(makeJsonRequest({ seasonId: -2027 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects fractional seasonId in body with 400", async () => {
    const response = await POST(makeJsonRequest({ seasonId: 2027.5 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects string seasonId in body with 400", async () => {
    const response = await POST(makeJsonRequest({ seasonId: "2027" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects Infinity as seasonId with 400", async () => {
    const response = await POST(makeRawRequest('{"seasonId":1e999}'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("ignores unknown fields in body (beyond clubId restriction)", async () => {
    const response = await POST(
      makeJsonRequest({ unknown: "ignored", extra: 99, seasonId: 2027 }),
    );

    expect(response.status).toBe(200);
  });

  // ── Request body structural validation ─────────────────────────────────────

  it("rejects malformed JSON with 400", async () => {
    const response = await POST(makeRawRequest("{invalid-json"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects JSON null body with 400", async () => {
    const response = await POST(makeRawRequest("null"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("rejects JSON array body with 400", async () => {
    const response = await POST(makeJsonRequest([{ seasonId: 1 }]));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // ── Tenant configuration resolution ────────────────────────────────────────

  it("returns 404 when no SFV configuration exists for the tenant", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigNotFoundError(TENANT_ID),
    );

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 409 when SFV integration is disabled for the tenant", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigDisabledError(TENANT_ID),
    );

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("does not call runSfvAdminDiagnostics when config is not found", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigNotFoundError(TENANT_ID),
    );

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when integration is disabled", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigDisabledError(TENANT_ID),
    );

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected config resolution failure", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new Error("Unexpected DB error"),
    );

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("500 response from config failure contains no internal details", async () => {
    mockRequireEnabledSfvConfigForTenant.mockRejectedValue(
      new Error("Unexpected DB error"),
    );

    const response = await POST(makeEmptyRequest());
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("Unexpected DB error");
    expect(json).not.toContain("DB");
  });

  // ── clubId always from config ──────────────────────────────────────────────

  it("clubId passed to diagnostics comes from tenant config, not from request", async () => {
    const config = makeConfig({ clubId: 999 });
    mockRequireEnabledSfvConfigForTenant.mockResolvedValue(config);

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 999 }),
    );
  });

  it("clubId from config is used even when body contains no clubId", async () => {
    const config = makeConfig({ clubId: 42 });
    mockRequireEnabledSfvConfigForTenant.mockResolvedValue(config);

    await POST(makeJsonRequest({}));

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 42 }),
    );
  });

  // ── seasonId resolution ────────────────────────────────────────────────────

  it("defaultSeasonId from config is used when no override is supplied", async () => {
    const config = makeConfig({ defaultSeasonId: 2026 });
    mockRequireEnabledSfvConfigForTenant.mockResolvedValue(config);

    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: 2026 }),
    );
  });

  it("explicit seasonId override replaces config.defaultSeasonId", async () => {
    const config = makeConfig({ defaultSeasonId: 2027 });
    mockRequireEnabledSfvConfigForTenant.mockResolvedValue(config);

    await POST(makeJsonRequest({ seasonId: 2025 }));

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: 2025 }),
    );
  });

  // ── Service invocation ──────────────────────────────────────────────────────

  it("calls requireEnabledSfvConfigForTenant exactly once per request", async () => {
    await POST(makeEmptyRequest());

    expect(mockRequireEnabledSfvConfigForTenant).toHaveBeenCalledOnce();
  });

  it("calls runSfvAdminDiagnostics exactly once per request", async () => {
    await POST(makeEmptyRequest());

    expect(mockRunSfvAdminDiagnostics).toHaveBeenCalledOnce();
  });

  it("does not call runSfvAdminDiagnostics when validation fails (clubId in body)", async () => {
    await POST(makeJsonRequest({ clubId: 1 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  it("does not call runSfvAdminDiagnostics when validation fails (invalid seasonId)", async () => {
    await POST(makeJsonRequest({ seasonId: -1 }));

    expect(mockRunSfvAdminDiagnostics).not.toHaveBeenCalled();
  });

  // ── HTTP status mapping ─────────────────────────────────────────────────────

  it("healthy diagnostics → 200", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeHealthyDiagnostics());

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(200);
  });

  it("degraded diagnostics → 200", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeDegradedDiagnostics());

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(200);
  });

  it("unhealthy with only retryable issue → 503", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyRetryableDiagnostics());

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(503);
  });

  it("unhealthy with only non-retryable issue → 502", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyNonRetryableDiagnostics());

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(502);
  });

  it("unhealthy with mixed issues (any retryable) → 503", async () => {
    mockRunSfvAdminDiagnostics.mockResolvedValue(makeUnhealthyMixedDiagnostics());

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(503);
  });

  it("unhealthy with no issues list (retryable field absent) → 502", async () => {
    const diag: SfvAdminDiagnostics = {
      ...makeUnhealthyNonRetryableDiagnostics(),
      issues: [
        { severity: "error", code: "SFV_SERVER_FAILURE", message: "Invalid response." },
      ],
    };
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(502);
  });

  it("unhealthy with retryable=false explicitly → 502", async () => {
    const diag: SfvAdminDiagnostics = {
      ...makeUnhealthyNonRetryableDiagnostics(),
      issues: [
        {
          severity: "error",
          code: "SFV_AUTH_FAILURE",
          message: "Auth failed.",
          retryable: false,
        },
      ],
    };
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(502);
  });

  // ── Response shape and content ──────────────────────────────────────────────

  it("healthy diagnostics returned in response envelope", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body).toHaveProperty("diagnostics");
    expect(body.diagnostics.health).toBe("healthy");
    expect(body.diagnostics.clubId).toBe(diag.clubId);
    expect(body.diagnostics.seasonId).toBe(diag.seasonId);
  });

  it("degraded diagnostics returned in response envelope", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.health).toBe("degraded");
    expect(body.diagnostics.issues).toHaveLength(1);
  });

  it("unhealthy diagnostics returned in response envelope (non-retryable)", async () => {
    const diag = makeUnhealthyNonRetryableDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.health).toBe("unhealthy");
    expect(body.diagnostics.issues).toHaveLength(1);
  });

  it("successful response has Content-Type application/json", async () => {
    const response = await POST(makeEmptyRequest());

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("counts are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.counts.ownTeams).toBe(11);
    expect(body.diagnostics.counts.scheduleRows).toBe(60);
    expect(body.diagnostics.counts.rankingRows).toBe(26);
    expect(body.diagnostics.counts.picturesPresent).toBe(43);
    expect(body.diagnostics.counts.picturesMissing).toBe(0);
    expect(body.diagnostics.counts.pictureFailures).toBe(0);
  });

  it("timings are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.timings).toHaveLength(2);
    expect(body.diagnostics.timings[0].stage).toBe("resolve-common-ids");
    expect(body.diagnostics.timings[1].stage).toBe("load-club-season-data");
    expect(typeof body.diagnostics.timings[0].durationMs).toBe("number");
  });

  it("totalDurationMs is preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(typeof body.diagnostics.totalDurationMs).toBe("number");
    expect(body.diagnostics.totalDurationMs).toBe(1000);
  });

  it("generatedAt timestamp is preserved in response", async () => {
    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.generatedAt).toBe("2026-07-12T10:00:00.000Z");
  });

  it("seasonName and seasonShortName are preserved in response", async () => {
    const diag = makeHealthyDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.seasonName).toBe("2026/2027");
    expect(body.diagnostics.seasonShortName).toBe("26/27");
  });

  it("issue codes are preserved in response", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.issues[0].code).toBe("SFV_SCHEDULE_NO_OWN_TEAM");
  });

  it("issue count field is preserved in degraded diagnostics", async () => {
    const diag = makeDegradedDiagnostics();
    mockRunSfvAdminDiagnostics.mockResolvedValue(diag);

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.diagnostics.issues[0].count).toBe(2);
  });

  // ── Safety: no credentials, tokens, or internal details ────────────────────

  it("response contains no base64-like values", async () => {
    const response = await POST(makeEmptyRequest());
    const json = JSON.stringify(await response.json());

    expect(json).not.toMatch(/[A-Za-z0-9+/]{100,}={0,2}/);
  });

  it("response contains no token-like fields", async () => {
    const response = await POST(makeEmptyRequest());
    const json = JSON.stringify(await response.json());

    expect(json).not.toMatch(/bearer/i);
    expect(json).not.toMatch(/authorization/i);
    expect(json).not.toContain("access_token");
    expect(json).not.toContain("applicationKey");
    expect(json).not.toContain("applicationPass");
  });

  it("response contains no stack trace material", async () => {
    const response = await POST(makeEmptyRequest());
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("at Object");
    expect(json).not.toContain("at async");
    expect(json).not.toContain(".ts:");
  });

  // ── Unexpected service failures ─────────────────────────────────────────────

  it("diagnostics service throws unexpected Error → 500 response", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected internal error"));

    const response = await POST(makeEmptyRequest());

    expect(response.status).toBe(500);
  });

  it("500 response contains generic error message (no internal details)", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected internal error"));

    const response = await POST(makeEmptyRequest());
    const body = await response.json();

    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("Unexpected internal error");
  });

  it("500 response contains no stack trace", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(
      Object.assign(new Error("Boom"), { stack: "Error: Boom\n    at route.ts:99" }),
    );

    const response = await POST(makeEmptyRequest());
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("route.ts:99");
    expect(json).not.toContain("at route");
    expect(json).not.toContain("Boom");
  });

  it("unexpected error response has content-type application/json", async () => {
    mockRunSfvAdminDiagnostics.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeEmptyRequest());

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });
});
