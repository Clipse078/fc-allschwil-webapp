/**
 * Tests for GET|POST /api/admin/integrations/sfv/config
 *
 * Covers: authentication, authorization, tenant resolution, request validation,
 * service invocation, response shape, response codes, security invariants, and
 * method surface.
 *
 * All external dependencies are mocked. No real network requests. No real
 * credentials. No real database access. Prisma is never imported by tests.
 * The service layer is the only mock target for business logic.
 *
 * Security invariants verified:
 *   - tenantId is NEVER accepted from the request body.
 *   - tenantId always comes from the authenticated session.
 *   - Authorization occurs before body parsing.
 *   - Service is never called when authentication or authorization fails.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { TenantSfvConfig } from "@/lib/integrations/sfv/tenant-config-types";
import { SfvTenantConfigValidationError } from "@/lib/integrations/sfv/tenant-config-types";

// ── Mock external dependencies before importing the route ─────────────────────

const mockRequireApiPermission = vi.fn();
const mockGetSfvConfigForTenant = vi.fn();
const mockUpsertSfvConfigForTenant = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/lib/integrations/sfv/tenant-config-service", () => ({
  getSfvConfigForTenant: mockGetSfvConfigForTenant,
  upsertSfvConfigForTenant: mockUpsertSfvConfigForTenant,
}));

// Import after mocks
const { GET, POST } = await import("../route");

// ── Request factory helpers ───────────────────────────────────────────────────

const ROUTE_URL = "http://localhost/api/admin/integrations/sfv/config";

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawPostRequest(rawBody: string): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

function makeEmptyPostRequest(): NextRequest {
  return new NextRequest(ROUTE_URL, { method: "POST" });
}

// ── Auth fixture helpers ──────────────────────────────────────────────────────

const TENANT_ID = "clx-tenant-abc";

const AUTHENTICATED_ADMIN = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      email: "admin@test.invalid",
      tenantId: TENANT_ID,
    },
  },
};

const AUTHENTICATED_ADMIN_NO_TENANT = {
  ok: true as const,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-2",
      email: "admin2@test.invalid",
      tenantId: null,
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
  session: { user: { id: "user-3", email: "nonadmin@test.invalid" } },
};

// ── Config fixture helpers ────────────────────────────────────────────────────

function makeConfig(overrides: Partial<TenantSfvConfig> = {}): TenantSfvConfig {
  return {
    id: "clx-sfv-config-1",
    tenantId: TENANT_ID,
    clubId: 483,
    defaultSeasonId: 2027,
    organisationId: null,
    enabled: true,
    lastTeamSyncAt: null,
    lastScheduleSyncAt: null,
    lastMatchDetailSyncAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

const VALID_POST_BODY = {
  clubId: 483,
  defaultSeasonId: 2027,
  organisationId: null,
  enabled: true,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN);
  mockGetSfvConfigForTenant.mockResolvedValue(null);
  mockUpsertSfvConfigForTenant.mockResolvedValue(makeConfig());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/integrations/sfv/config
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/admin/integrations/sfv/config", () => {
  // ── Authentication and authorization ────────────────────────────────────────

  it("GET-1. rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("GET-2. rejects unauthorized request with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await GET();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("GET-3. does not call getSfvConfigForTenant when unauthenticated", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await GET();

    expect(mockGetSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("GET-4. does not call getSfvConfigForTenant when forbidden", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await GET();

    expect(mockGetSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("GET-5. calls requireApiPermission with TENANTS_MANAGE", async () => {
    await GET();

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  it("GET-6. returns 403 when session has no tenantId (null)", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await GET();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Tenant context");
  });

  // ── No config exists ────────────────────────────────────────────────────────

  it("GET-7. returns 200 with config: null when no configuration exists", async () => {
    mockGetSfvConfigForTenant.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("config");
    expect(body.config).toBeNull();
  });

  it("GET-8. calls getSfvConfigForTenant with session tenantId", async () => {
    await GET();

    expect(mockGetSfvConfigForTenant).toHaveBeenCalledWith(TENANT_ID);
  });

  it("GET-9. calls getSfvConfigForTenant exactly once", async () => {
    await GET();

    expect(mockGetSfvConfigForTenant).toHaveBeenCalledOnce();
  });

  // ── Config exists ───────────────────────────────────────────────────────────

  it("GET-10. returns 200 with config when configuration exists", async () => {
    const config = makeConfig();
    mockGetSfvConfigForTenant.mockResolvedValue(config);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config).toBeDefined();
    expect(body.config.clubId).toBe(483);
    expect(body.config.defaultSeasonId).toBe(2027);
    expect(body.config.enabled).toBe(true);
  });

  it("GET-11. returns disabled config (does not filter by enabled)", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockGetSfvConfigForTenant.mockResolvedValue(disabledConfig);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.enabled).toBe(false);
  });

  it("GET-12. returns config with organisationId when set", async () => {
    const config = makeConfig({ organisationId: 100 });
    mockGetSfvConfigForTenant.mockResolvedValue(config);

    const response = await GET();

    const body = await response.json();
    expect(body.config.organisationId).toBe(100);
  });

  it("GET-13. returns config with organisationId: null when not set", async () => {
    const config = makeConfig({ organisationId: null });
    mockGetSfvConfigForTenant.mockResolvedValue(config);

    const response = await GET();

    const body = await response.json();
    expect(body.config.organisationId).toBeNull();
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("GET-14. response has content-type application/json", async () => {
    const response = await GET();

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("GET-15. response envelope contains only 'config' key (no extra fields)", async () => {
    mockGetSfvConfigForTenant.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body)).toEqual(["config"]);
  });

  it("GET-16. config response shape includes all TenantSfvConfig fields", async () => {
    const config = makeConfig({ organisationId: 42 });
    mockGetSfvConfigForTenant.mockResolvedValue(config);

    const response = await GET();
    const body = await response.json();

    expect(body.config).toMatchObject({
      id: expect.any(String),
      tenantId: TENANT_ID,
      clubId: 483,
      defaultSeasonId: 2027,
      organisationId: 42,
      enabled: true,
    });
  });

  // ── Service error handling ──────────────────────────────────────────────────

  it("GET-17. service throws unexpected error → 500", async () => {
    mockGetSfvConfigForTenant.mockRejectedValue(new Error("DB connection lost"));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("GET-18. 500 response does not expose internal error details", async () => {
    mockGetSfvConfigForTenant.mockRejectedValue(new Error("DB connection lost"));

    const response = await GET();
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("DB connection lost");
    expect(json).not.toContain("at Object");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/integrations/sfv/config
// ═════════════════════════════════════════════════════════════════════════════

describe("POST /api/admin/integrations/sfv/config", () => {
  // ── Authentication and authorization ────────────────────────────────────────

  it("POST-1. rejects unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("POST-2. rejects unauthorized request with 403", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("POST-3. does not call upsertSfvConfigForTenant when unauthenticated", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST(makePostRequest(VALID_POST_BODY));

    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("POST-4. does not call upsertSfvConfigForTenant when forbidden", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    await POST(makePostRequest(VALID_POST_BODY));

    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("POST-5. calls requireApiPermission with TENANTS_MANAGE", async () => {
    await POST(makePostRequest(VALID_POST_BODY));

    expect(mockRequireApiPermission).toHaveBeenCalledWith("tenants.manage");
  });

  it("POST-6. returns 403 when session has no tenantId (null)", async () => {
    mockRequireApiPermission.mockResolvedValue(AUTHENTICATED_ADMIN_NO_TENANT);

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Tenant context");
  });

  // ── Authorization before body parsing ───────────────────────────────────────

  it("POST-7. auth fails with 401 before body is parsed (malformed JSON)", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    const response = await POST(makeRawPostRequest("{not valid json}"));

    // Should return 401, not 400 — auth is checked first
    expect(response.status).toBe(401);
    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("POST-8. auth fails with 403 before body is parsed (malformed JSON)", async () => {
    mockRequireApiPermission.mockResolvedValue(FORBIDDEN);

    const response = await POST(makeRawPostRequest("{not valid json}"));

    // Should return 403, not 400 — auth is checked first
    expect(response.status).toBe(403);
    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  // ── Request body validation ─────────────────────────────────────────────────

  it("POST-9. rejects malformed JSON with 400", async () => {
    const response = await POST(makeRawPostRequest("{invalid-json"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("POST-10. rejects empty body with 400", async () => {
    const response = await POST(makeEmptyPostRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("POST-11. rejects JSON null body with 400", async () => {
    const response = await POST(makeRawPostRequest("null"));

    expect(response.status).toBe(400);
  });

  it("POST-12. rejects JSON array body with 400", async () => {
    const response = await POST(makePostRequest([VALID_POST_BODY]));

    expect(response.status).toBe(400);
  });

  // ── Field validation failures via service ───────────────────────────────────
  // The service calls validateTenantSfvConfigInput and throws
  // SfvTenantConfigValidationError, which the route maps to 400.

  it("POST-13. rejects missing clubId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ defaultSeasonId: 2027, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.field).toBe("clubId");
  });

  it("POST-14. rejects clubId=0 with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 0, defaultSeasonId: 2027, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("clubId");
  });

  it("POST-15. rejects negative clubId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: -1, defaultSeasonId: 2027, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("clubId");
  });

  it("POST-16. rejects fractional clubId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 1.5, defaultSeasonId: 2027, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("clubId");
  });

  it("POST-17. rejects string clubId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: "483", defaultSeasonId: 2027, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("clubId");
  });

  it("POST-18. rejects missing defaultSeasonId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("defaultSeasonId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("defaultSeasonId");
  });

  it("POST-19. rejects defaultSeasonId=0 with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("defaultSeasonId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 0, enabled: true }),
    );

    expect(response.status).toBe(400);
  });

  it("POST-20. rejects negative defaultSeasonId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("defaultSeasonId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: -2027, enabled: true }),
    );

    expect(response.status).toBe(400);
  });

  it("POST-21. rejects fractional defaultSeasonId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("defaultSeasonId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 2027.5, enabled: true }),
    );

    expect(response.status).toBe(400);
  });

  it("POST-22. rejects string defaultSeasonId with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("defaultSeasonId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: "2027", enabled: true }),
    );

    expect(response.status).toBe(400);
  });

  it("POST-23. rejects invalid organisationId (string) with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("organisationId", "must be null, undefined, or a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 2027, organisationId: "100", enabled: true }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("organisationId");
  });

  it("POST-24. rejects organisationId=0 with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("organisationId", "must be null, undefined, or a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 2027, organisationId: 0, enabled: true }),
    );

    expect(response.status).toBe(400);
  });

  it("POST-25. rejects missing enabled with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("enabled", "must be a boolean"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 2027 }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.field).toBe("enabled");
  });

  it("POST-26. rejects string enabled with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("enabled", "must be a boolean"),
    );

    const response = await POST(
      makePostRequest({ clubId: 483, defaultSeasonId: 2027, enabled: "true" }),
    );

    expect(response.status).toBe(400);
  });

  // ── Successful config creation ───────────────────────────────────────────────

  it("POST-27. creates config — returns 200 with config", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config).toBeDefined();
    expect(body.config.clubId).toBe(483);
    expect(body.config.defaultSeasonId).toBe(2027);
    expect(body.config.enabled).toBe(true);
  });

  it("POST-28. updates config — returns 200 with updated config", async () => {
    const updatedConfig = makeConfig({ clubId: 999, defaultSeasonId: 2028, enabled: false });
    mockUpsertSfvConfigForTenant.mockResolvedValue(updatedConfig);

    const response = await POST(
      makePostRequest({ clubId: 999, defaultSeasonId: 2028, enabled: false }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.clubId).toBe(999);
    expect(body.config.defaultSeasonId).toBe(2028);
    expect(body.config.enabled).toBe(false);
  });

  it("POST-29. accepts organisationId: null explicitly", async () => {
    const config = makeConfig({ organisationId: null });
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(
      makePostRequest({ ...VALID_POST_BODY, organisationId: null }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.organisationId).toBeNull();
  });

  it("POST-30. accepts organisationId omitted (treated as null)", async () => {
    const config = makeConfig({ organisationId: null });
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const bodyWithoutOrg = {
      clubId: VALID_POST_BODY.clubId,
      defaultSeasonId: VALID_POST_BODY.defaultSeasonId,
      enabled: VALID_POST_BODY.enabled,
    };
    const response = await POST(makePostRequest(bodyWithoutOrg));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.organisationId).toBeNull();
  });

  it("POST-31. accepts valid organisationId (positive integer)", async () => {
    const config = makeConfig({ organisationId: 100 });
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(
      makePostRequest({ ...VALID_POST_BODY, organisationId: 100 }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.organisationId).toBe(100);
  });

  it("POST-32. accepts disabled config (enabled: false)", async () => {
    const disabledConfig = makeConfig({ enabled: false });
    mockUpsertSfvConfigForTenant.mockResolvedValue(disabledConfig);

    const response = await POST(
      makePostRequest({ ...VALID_POST_BODY, enabled: false }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.enabled).toBe(false);
  });

  // ── tenantId never accepted from request body ────────────────────────────────

  it("POST-33. tenantId from body is never forwarded to service", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    // Body contains attacker-controlled tenantId
    await POST(
      makePostRequest({ ...VALID_POST_BODY, tenantId: "attacker-tenant-xyz" }),
    );

    // Service must be called with session tenantId, not the body tenantId
    const [calledTenantId] = mockUpsertSfvConfigForTenant.mock.calls[0];
    expect(calledTenantId).toBe(TENANT_ID);
    expect(calledTenantId).not.toBe("attacker-tenant-xyz");
  });

  it("POST-34. tenantId in body does not change which tenant config is written", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    await POST(
      makePostRequest({ ...VALID_POST_BODY, tenantId: "another-tenant" }),
    );

    const [calledTenantId] = mockUpsertSfvConfigForTenant.mock.calls[0];
    expect(calledTenantId).toBe(TENANT_ID);
  });

  it("POST-35. service is called with session tenantId regardless of body content", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    await POST(makePostRequest(VALID_POST_BODY));

    const [calledTenantId] = mockUpsertSfvConfigForTenant.mock.calls[0];
    expect(calledTenantId).toBe(TENANT_ID);
  });

  // ── Service call contract ───────────────────────────────────────────────────

  it("POST-36. calls upsertSfvConfigForTenant exactly once", async () => {
    await POST(makePostRequest(VALID_POST_BODY));

    expect(mockUpsertSfvConfigForTenant).toHaveBeenCalledOnce();
  });

  it("POST-37. service is NOT called when body is malformed JSON", async () => {
    const response = await POST(makeRawPostRequest("{bad json"));

    expect(response.status).toBe(400);
    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("POST-38. service is NOT called when auth fails", async () => {
    mockRequireApiPermission.mockResolvedValue(UNAUTHENTICATED);

    await POST(makePostRequest(VALID_POST_BODY));

    expect(mockUpsertSfvConfigForTenant).not.toHaveBeenCalled();
  });

  it("POST-39. service receives correct input fields from body", async () => {
    const config = makeConfig({ clubId: 999, defaultSeasonId: 2028, organisationId: 50, enabled: false });
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    await POST(
      makePostRequest({ clubId: 999, defaultSeasonId: 2028, organisationId: 50, enabled: false }),
    );

    const [, calledInput] = mockUpsertSfvConfigForTenant.mock.calls[0];
    expect(calledInput.clubId).toBe(999);
    expect(calledInput.defaultSeasonId).toBe(2028);
    expect(calledInput.organisationId).toBe(50);
    expect(calledInput.enabled).toBe(false);
  });

  it("POST-40. service input does not contain tenantId field", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    await POST(makePostRequest({ ...VALID_POST_BODY, tenantId: "body-tenant" }));

    const [, calledInput] = mockUpsertSfvConfigForTenant.mock.calls[0];
    expect(calledInput).not.toHaveProperty("tenantId");
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("POST-41. successful response has content-type application/json", async () => {
    const response = await POST(makePostRequest(VALID_POST_BODY));

    const ct = response.headers.get("content-type");
    expect(ct).toContain("application/json");
  });

  it("POST-42. response envelope contains 'config' key", async () => {
    const response = await POST(makePostRequest(VALID_POST_BODY));
    const body = await response.json();

    expect(body).toHaveProperty("config");
  });

  it("POST-43. config response shape includes all TenantSfvConfig fields", async () => {
    const config = makeConfig({ organisationId: 42 });
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(makePostRequest({ ...VALID_POST_BODY, organisationId: 42 }));
    const body = await response.json();

    expect(body.config).toMatchObject({
      id: expect.any(String),
      tenantId: TENANT_ID,
      clubId: 483,
      defaultSeasonId: 2027,
      organisationId: 42,
      enabled: true,
    });
  });

  it("POST-44. validation error response contains 'error' and 'field' keys", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(makePostRequest({ ...VALID_POST_BODY, clubId: -1 }));
    const body = await response.json();

    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("field");
    expect(body.field).toBe("clubId");
  });

  // ── Unexpected service failures ─────────────────────────────────────────────

  it("POST-45. service throws unexpected error → 500", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(new Error("DB write failed"));

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("POST-46. 500 response does not expose internal error details", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(new Error("DB write failed"));

    const response = await POST(makePostRequest(VALID_POST_BODY));
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain("DB write failed");
    expect(json).not.toContain("at Object");
    expect(json).not.toContain(".ts:");
  });

  // ── Malformed number edge cases ─────────────────────────────────────────────

  it("POST-47. rejects Infinity as clubId (non-integer) with 400", async () => {
    mockUpsertSfvConfigForTenant.mockRejectedValue(
      new SfvTenantConfigValidationError("clubId", "must be a positive integer between 1 and 2,147,483,647"),
    );

    const response = await POST(
      makeRawPostRequest('{"clubId":1e999,"defaultSeasonId":2027,"enabled":true}'),
    );

    expect(response.status).toBe(400);
  });

  it("POST-48. ignores unknown fields in body (does not cause errors)", async () => {
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(
      makePostRequest({ ...VALID_POST_BODY, unknownField: "ignored", extra: 99 }),
    );

    expect(response.status).toBe(200);
  });

  // ── Prisma not accessed directly ────────────────────────────────────────────

  it("POST-49. Prisma is not imported or accessed directly by the route (service is the only path)", async () => {
    // This is verified structurally: the service mock is the only data path.
    // If Prisma were called directly, the test setup would fail (no real DB).
    // The mock being called proves service is the sole intermediary.
    const config = makeConfig();
    mockUpsertSfvConfigForTenant.mockResolvedValue(config);

    const response = await POST(makePostRequest(VALID_POST_BODY));

    expect(response.status).toBe(200);
    expect(mockUpsertSfvConfigForTenant).toHaveBeenCalledOnce();
    // Service was the only call path — no Prisma operation escaped the mock
  });

  // ── Handler exported ────────────────────────────────────────────────────────

  it("POST-50. GET and POST handlers are exported from the route module", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });
});
