/**
 * Tests for POST /api/admin/integrations/sfv/tournaments/sync
 *
 * Contract:
 *   - tenantId is never accepted from the request — always from the
 *     authenticated session (same as every other SFV sync route).
 *   - Authorization requires TENANTS_MANAGE (same as schedule/teams/
 *     competitions/detail sync).
 *   - Missing configuration → 404. Disabled integration → 409.
 *   - Successful diagnostic run → 200 with `{ result: SfvTournamentSyncResult }`,
 *     always reporting `blocked: true` in this release (see
 *     lib/integrations/sfv/sync/tournament-sync.ts for why).
 *
 * All external dependencies are mocked. No real network requests. No real
 * database access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRequireApiPermission = vi.fn();
const mockSyncSfvTournaments = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/integrations/sfv/sync/tournament-sync", () => ({
  syncSfvTournaments: mockSyncSfvTournaments,
}));

import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";

const { POST } = await import("../route");

const TENANT_ID = "tenant-abc-123";

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
    user: { id: "user-1", email: "admin@test.invalid", activeTenantId: null },
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

function makeBlockedResult(overrides: Record<string, unknown> = {}) {
  return {
    startedAt: "2026-08-06T10:00:00.000Z",
    finishedAt: "2026-08-06T10:00:00.010Z",
    durationMs: 10,
    tenantId: TENANT_ID,
    source: "SFV",
    clubId: 483,
    seasonId: 2027,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    blocked: true,
    warnings: [
      {
        code: "PROVIDER_SOURCE_UNAVAILABLE",
        message: "No structured SFV/FVNW tournament endpoint exists.",
      },
    ],
    recommendedAction: "Create tournaments manually via Events → Turniere.",
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
  mockSyncSfvTournaments.mockResolvedValue(makeBlockedResult());
});

describe("POST /api/admin/integrations/sfv/tournaments/sync", () => {
  it("route module exports POST handler", () => {
    expect(typeof POST).toBe("function");
  });

  // ── Authorization ────────────────────────────────────────────────────────

  it("requires TENANTS_MANAGE permission", async () => {
    await POST();

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  it("rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await POST();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects unauthorized request with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await POST();

    expect(response.status).toBe(403);
  });

  it("does not call syncSfvTournaments when unauthenticated", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST();

    expect(mockSyncSfvTournaments).not.toHaveBeenCalled();
  });

  it("returns 403 when tenantId is missing from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await POST();

    expect(response.status).toBe(403);
  });

  it("does not call syncSfvTournaments when tenantId missing from session", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    await POST();

    expect(mockSyncSfvTournaments).not.toHaveBeenCalled();
  });

  // ── Tenant-safe contract ─────────────────────────────────────────────────

  it("calls syncSfvTournaments with the session-derived tenantId", async () => {
    await POST();

    expect(mockSyncSfvTournaments).toHaveBeenCalledWith(TENANT_ID);
    expect(mockSyncSfvTournaments).toHaveBeenCalledOnce();
  });

  // ── Error mapping ────────────────────────────────────────────────────────

  it("returns 404 when no SFV configuration exists for the tenant", async () => {
    mockSyncSfvTournaments.mockRejectedValue(new SfvTenantConfigNotFoundError(TENANT_ID));

    const response = await POST();

    expect(response.status).toBe(404);
  });

  it("returns 409 when SFV integration is disabled for the tenant", async () => {
    mockSyncSfvTournaments.mockRejectedValue(new SfvTenantConfigDisabledError(TENANT_ID));

    const response = await POST();

    expect(response.status).toBe(409);
  });

  it("returns 500 on unexpected failure with no internal details exposed", async () => {
    mockSyncSfvTournaments.mockRejectedValue(new Error("Unexpected DB error"));

    const response = await POST();
    const json = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(json).not.toContain("Unexpected DB error");
  });

  // ── Successful diagnostic response ──────────────────────────────────────

  it("returns 200 with the diagnostic result on success", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toBeDefined();
  });

  it("response reports blocked: true", async () => {
    const response = await POST();
    const body = await response.json();

    expect(body.result.blocked).toBe(true);
  });

  it("response contains zero counts across the board", async () => {
    const response = await POST();
    const body = await response.json();

    expect(body.result.fetched).toBe(0);
    expect(body.result.created).toBe(0);
    expect(body.result.updated).toBe(0);
    expect(body.result.unchanged).toBe(0);
    expect(body.result.failed).toBe(0);
  });

  it("response includes at least one warning entry", async () => {
    const response = await POST();
    const body = await response.json();

    expect(body.result.warnings.length).toBeGreaterThan(0);
  });

  it("repeated calls are idempotent (same shape returned both times)", async () => {
    const first = await (await POST()).json();
    const second = await (await POST()).json();

    expect(first.result.blocked).toBe(second.result.blocked);
    expect(first.result.warnings).toEqual(second.result.warnings);
    expect(first.result.recommendedAction).toEqual(second.result.recommendedAction);
  });

  it("successful response has Content-Type application/json", async () => {
    const response = await POST();

    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("never exposes credential-like fields in the response", async () => {
    const response = await POST();
    const json = JSON.stringify(await response.json());

    expect(json).not.toMatch(/bearer/i);
    expect(json).not.toContain("applicationKey");
    expect(json).not.toContain("applicationPass");
  });
});
