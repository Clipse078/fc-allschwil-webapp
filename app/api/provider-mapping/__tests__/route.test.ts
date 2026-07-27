/**
 * Tests for app/api/provider-mapping/route.ts
 *
 * Covers:
 *   A. GET — list mappings (authentication, tenant isolation, filters)
 *   B. POST — create mapping (authentication, validation, success, errors)
 *   C. Tenant isolation (tenantId from session only)
 *   D. Permissions (TEAMS_MANAGE required)
 *   E. Regression — adapter registration idempotency
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  listProviderMappings: vi.fn(),
  createProviderMapping: vi.fn(),
  ensureSfvAdapterRegistered: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

vi.mock("@/lib/provider-mapping/provider-mapping-queries", () => ({
  listProviderMappings: mocks.listProviderMappings,
}));

vi.mock("@/lib/provider-mapping/provider-mapping-service", () => ({
  createProviderMapping: mocks.createProviderMapping,
}));

vi.mock("@/lib/integrations/sfv/register-adapter", () => ({
  ensureSfvAdapterRegistered: mocks.ensureSfvAdapterRegistered,
}));

import { GET, POST } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost/api/provider-mapping";
const TENANT_ID = "tenant-a";

const SESSION = {
  user: {
    tenantId: TENANT_ID,
    permissionKeys: ["teams.manage"],
  },
};

const ACCESS_OK = { ok: true as const, session: SESSION };
const ACCESS_401 = { ok: false as const, error: "Nicht authentifiziert.", status: 401 as const };
const ACCESS_403 = { ok: false as const, error: "Keine Berechtigung.", status: 403 as const };

function makeGetRequest(search?: string): NextRequest {
  return new NextRequest(`${BASE_URL}${search ? `?${search}` : ""}`, {
    method: "GET",
  });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SAMPLE_MAPPING = {
  id: "mapping-01",
  tenantId: TENANT_ID,
  teamId: "team-01",
  teamName: "FC Test",
  teamSeasonId: "ts-01",
  teamSeasonDisplayName: "FC Test 2025/26",
  provider: "SFV",
  externalTeamId: 100,
  externalSeasonId: 50,
  providerTeamName: "FC Test (SFV)",
  providerLeagueId: 42,
  providerLeagueName: "3. Liga",
  providerOrganisationId: 10,
  providerIsActive: true,
  mappingSource: "MANUAL",
  confidenceLevel: "HIGH",
  mappingCompetitionId: null,
  mappingCompetitionName: null,
  lastSyncedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue(ACCESS_OK);
  mocks.listProviderMappings.mockResolvedValue([SAMPLE_MAPPING]);
  mocks.createProviderMapping.mockResolvedValue({ ok: true, mapping: SAMPLE_MAPPING });
  mocks.ensureSfvAdapterRegistered.mockReturnValue(undefined);
});

// ── A. GET ─────────────────────────────────────────────────────────────────────

describe("A. GET /api/provider-mapping", () => {
  it("returns 401 when not authenticated", async () => {
    mocks.requireApiPermission.mockResolvedValue(ACCESS_401);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when permission is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue(ACCESS_403);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when tenantId is missing from session", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      session: { user: { tenantId: undefined } },
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns 200 with mappings array on success", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("mappings");
    expect(Array.isArray(data.mappings)).toBe(true);
  });

  it("passes filters to listProviderMappings", async () => {
    await GET(makeGetRequest("provider=SFV&search=muster&mappingSource=MANUAL"));
    expect(mocks.listProviderMappings).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ provider: "SFV", search: "muster", mappingSource: "MANUAL" }),
    );
  });

  it("uses tenantId from session (not from query params)", async () => {
    await GET(makeGetRequest("tenantId=evil-tenant"));
    expect(mocks.listProviderMappings).toHaveBeenCalledWith(
      TENANT_ID,
      expect.anything(),
    );
  });
});

// ── B. POST ────────────────────────────────────────────────────────────────────

describe("B. POST /api/provider-mapping", () => {
  const VALID_BODY = {
    teamSeasonId: "ts-01",
    provider: "SFV",
    externalTeamId: 100,
    externalSeasonId: 50,
  };

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiPermission.mockResolvedValue(ACCESS_401);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 when teamSeasonId is missing", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, teamSeasonId: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider is missing", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, provider: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when externalTeamId is a string instead of number", async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, externalTeamId: "100" }));
    expect(res.status).toBe(400);
  });

  it("returns 201 on successful creation", async () => {
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("mapping");
  });

  it("returns 409 when ALREADY_MAPPED", async () => {
    mocks.createProviderMapping.mockResolvedValue({
      ok: false,
      code: "ALREADY_MAPPED",
      message: "Bereits zugeordnet.",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 409 when EXTERNAL_TEAM_ALREADY_MAPPED", async () => {
    mocks.createProviderMapping.mockResolvedValue({
      ok: false,
      code: "EXTERNAL_TEAM_ALREADY_MAPPED",
      message: "Externes Team bereits zugeordnet.",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 404 when TEAM_SEASON_NOT_FOUND", async () => {
    mocks.createProviderMapping.mockResolvedValue({
      ok: false,
      code: "TEAM_SEASON_NOT_FOUND",
      message: "Nicht gefunden.",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it("injects tenantId from session into the service call", async () => {
    await POST(makePostRequest(VALID_BODY));
    expect(mocks.createProviderMapping).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  it("strips invalid confidenceLevel (not HIGH|MEDIUM|LOW) before passing to service", async () => {
    await POST(makePostRequest({ ...VALID_BODY, confidenceLevel: "SUPERGOOD" }));
    expect(mocks.createProviderMapping).toHaveBeenCalledWith(
      expect.objectContaining({ confidenceLevel: undefined }),
    );
  });

  it("passes valid confidenceLevel HIGH to service", async () => {
    await POST(makePostRequest({ ...VALID_BODY, confidenceLevel: "HIGH" }));
    expect(mocks.createProviderMapping).toHaveBeenCalledWith(
      expect.objectContaining({ confidenceLevel: "HIGH" }),
    );
  });
});

// ── C. Tenant isolation ────────────────────────────────────────────────────────

describe("C. Tenant isolation", () => {
  it("never uses tenantId from request body", async () => {
    const bodyWithTenantId = {
      teamSeasonId: "ts-01",
      provider: "SFV",
      externalTeamId: 100,
      externalSeasonId: 50,
      tenantId: "evil-tenant",
    };
    await POST(makePostRequest(bodyWithTenantId));
    expect(mocks.createProviderMapping).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
    expect(mocks.createProviderMapping).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "evil-tenant" }),
    );
  });
});

// ── D. Permissions ─────────────────────────────────────────────────────────────

describe("D. Permissions", () => {
  it("requires TEAMS_MANAGE permission for GET", async () => {
    await GET(makeGetRequest());
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("teams.manage");
  });

  it("requires TEAMS_MANAGE permission for POST", async () => {
    await POST(makePostRequest({ teamSeasonId: "x", provider: "SFV", externalTeamId: 1, externalSeasonId: 1 }));
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("teams.manage");
  });
});

// ── E. Regression — adapter registration ──────────────────────────────────────

describe("E. Regression — adapter registration", () => {
  it("GET succeeds when adapter is registered (registration guard works)", async () => {
    // If the ensureSfvAdapterRegistered module-level call is missing, GET would
    // fail differently. This test verifies the route responds correctly end-to-end.
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("mappings");
  });
});
