/**
 * Tests for GET /api/ops/club-directory-02c-sfv-consolidation
 * CLUB-DIRECTORY-02C-OPS.
 *
 * All external dependencies are mocked — no real database, no real SFV
 * network access, no real credentials. Verifies:
 *   - inventory performs zero writes (no mutating function is ever called
 *     or even importable from this route — see the "cannot mutate"
 *     section below).
 *   - dry-run performs zero writes (same guarantee — it only calls the
 *     pure, already-tested plan-building function).
 *   - execute is impossible through the route (fixed mode allow-list;
 *     the route module never imports the mutating service functions at
 *     all).
 *   - missing/invalid auth is rejected.
 *   - a tenant other than "fc-allschwil" is rejected.
 *   - the endpoint is STAGE-only.
 *   - credentials/tokens/raw SFV payloads never appear in the response.
 *   - the CLI script this route delegates to is imported, not duplicated.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computePlanFingerprint } from "@/lib/club-directory/plan-fingerprint";

const mockResolveTenantContexts = vi.fn();
const mockLoadTenantInventory = vi.fn();
const mockBuildTenantPlan = vi.fn();
const mockRequireApiPermission = vi.fn();

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/scripts/club-directory-02c-sfv-consolidation", () => ({
  resolveTenantContexts: mockResolveTenantContexts,
  loadTenantInventory: mockLoadTenantInventory,
  buildTenantPlan: mockBuildTenantPlan,
}));

const routeModule = await import("../route");
const { GET } = routeModule;

const ORIGINAL_ENV = { ...process.env };

const ROUTE_PATH = "http://x/api/ops/club-directory-02c-sfv-consolidation";
const TENANT_KEY = "fc-allschwil";
const LEGACY_BEARER = "test-consolidation-operator-secret";

const TENANT_CONTEXT = {
  tenantId: "tenant-fc-allschwil-id",
  tenantKey: TENANT_KEY,
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
};

const DUPLICATE_GROUP = {
  providerClubId: 700,
  distinctClubIds: ["club-a", "club-b"],
  teamCount: 2,
  providerTeamIds: [2001, 2002],
};

const INVENTORY = {
  tenant: TENANT_CONTEXT,
  resolvedTeamCount: 11,
  duplicateGroups: [DUPLICATE_GROUP],
};

const PLAN = {
  tenant: TENANT_CONTEXT,
  groups: [
    {
      providerClubId: 700,
      canonicalClubId: "club-b",
      clubsToArchive: ["club-a"],
      teamsToMove: 1,
      logoAdoptedFromClubId: null,
    },
  ],
};

function makeRequest(
  query: Record<string, string | undefined>,
  headers: Record<string, string> = {},
): NextRequest {
  const url = new URL(ROUTE_PATH);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: "GET", headers });
}

function authHeaders(secret = LEGACY_BEARER): Record<string, string> {
  return { authorization: `Bearer ${secret}` };
}

function setStageEnvironment(): void {
  process.env.NODE_ENV = "production";
  process.env.APP_ENV = "stage";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  setStageEnvironment();
  mockRequireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "platform-operator" } },
  });
  mockResolveTenantContexts.mockResolvedValue([TENANT_CONTEXT]);
  mockLoadTenantInventory.mockResolvedValue(INVENTORY);
  mockBuildTenantPlan.mockResolvedValue(PLAN);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ---------------------------------------------------------------------------
// Route module shape — proves execute is not reachable at all
// ---------------------------------------------------------------------------

describe("route module shape", () => {
  it("exports only GET — no POST/PUT/PATCH/DELETE handler exists", () => {
    expect(typeof routeModule.GET).toBe("function");
    expect((routeModule as Record<string, unknown>).POST).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PATCH).toBeUndefined();
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined();
  });

  it("route source never imports the mutating consolidation functions", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/ops/club-directory-02c-sfv-consolidation/route.ts"),
      "utf-8",
    );
    // Strip block/line comments before scanning so this assertion checks
    // actual code, not the module doc's explanation of what it does NOT do.
    const code = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(code).not.toContain("runSfvClubConsolidationForTenant");
    expect(code).not.toContain("consolidateExternalClubsByProviderIdentity");
    expect(code).not.toContain("EXECUTE_CONFIRMATION");
    expect(code).not.toMatch(/from\s+["']@\/lib\/integrations\/sfv\/sync\/club-consolidation["']/);
    expect(code).not.toMatch(/from\s+["']@\/lib\/club-directory\/consolidation-service["']/);
  });

  it("route source reuses the CLI script's pure functions instead of duplicating logic", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/ops/club-directory-02c-sfv-consolidation/route.ts"),
      "utf-8",
    );
    expect(content).toContain("@/scripts/club-directory-02c-sfv-consolidation");
    expect(content).toContain("resolveTenantContexts");
    expect(content).toContain("loadTenantInventory");
    expect(content).toContain("buildTenantPlan");
  });
});

// ---------------------------------------------------------------------------
// STAGE-only guard
// ---------------------------------------------------------------------------

describe("GET — STAGE-only guard", () => {
  it("rejects with 403 when APP_ENV is not stage (local)", async () => {
    process.env.APP_ENV = "local";

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects with 403 when APP_ENV is prod", async () => {
    process.env.APP_ENV = "prod";

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects with 403 when APP_ENV is unset (defaults to local)", async () => {
    delete process.env.APP_ENV;

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(403);
  });

  it("does not leak whether auth would have succeeded when blocked by the STAGE guard", async () => {
    process.env.APP_ENV = "prod";

    // Even a correct secret must not bypass the STAGE guard.
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders(LEGACY_BEARER)),
    );

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("allows the request through the STAGE guard when APP_ENV=stage", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("GET — authentication", () => {
  it("rejects an unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await GET(makeRequest({ tenant: TENANT_KEY, mode: "inventory" }));
    expect(response.status).toBe(401);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects an ordinary tenant Club Admin with 403", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "club-admin" } },
    });

    const response = await GET(makeRequest({ tenant: TENANT_KEY, mode: "inventory" }));

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("does not accept the routine CRON_SECRET without an operator session", async () => {
    process.env.CRON_SECRET = "routine-cron-secret";
    mockRequireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await GET(
      makeRequest(
        { tenant: TENANT_KEY, mode: "inventory" },
        authHeaders("routine-cron-secret"),
      ),
    );

    expect(response.status).toBe(401);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("requires the existing platform-only tenants.manage permission", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }),
    );

    expect(response.status).toBe(200);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      "tenants.manage",
    );
  });
});

// ---------------------------------------------------------------------------
// Tenant must be explicit and exactly "fc-allschwil"
// ---------------------------------------------------------------------------

describe("GET — tenant restriction", () => {
  it("rejects with 403 when tenant is missing", async () => {
    const response = await GET(makeRequest({ mode: "inventory" }, authHeaders()));

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects with 403 for any tenant other than fc-allschwil", async () => {
    const response = await GET(
      makeRequest({ tenant: "some-other-tenant", mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects with 403 for an attempted cross-tenant/SQL-injection-style value", async () => {
    const response = await GET(
      makeRequest({ tenant: "fc-allschwil' OR '1'='1", mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(403);
  });

  it("accepts exactly fc-allschwil", async () => {
    const response = await GET(
      makeRequest({ tenant: "fc-allschwil", mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(200);
    expect(mockResolveTenantContexts).toHaveBeenCalledWith(expect.anything(), "fc-allschwil");
  });

  it("returns 404 when no enabled SFV configuration exists for the tenant", async () => {
    mockResolveTenantContexts.mockResolvedValue([]);

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(404);
    expect(mockLoadTenantInventory).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mode allow-list — execute/confirm/mutation/unsupported are impossible
// ---------------------------------------------------------------------------

describe("GET — mode allow-list (execute is impossible through this route)", () => {
  it.each(["execute", "confirm", "mutation", "delete", "ExecuteNow", "inventory ", ""])(
    "rejects unsupported mode %j with 400 and performs zero writes",
    async (mode) => {
      const response = await GET(
        makeRequest({ tenant: TENANT_KEY, mode }, authHeaders()),
      );

      expect(response.status).toBe(400);
      expect(mockResolveTenantContexts).not.toHaveBeenCalled();
      expect(mockLoadTenantInventory).not.toHaveBeenCalled();
      expect(mockBuildTenantPlan).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing mode with 400", async () => {
    const response = await GET(makeRequest({ tenant: TENANT_KEY }, authHeaders()));

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("accepts mode=inventory", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );

    expect(response.status).toBe(200);
  });

  it("accepts mode=dry-run", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()),
    );

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Inventory mode — zero writes, reuses loadTenantInventory only
// ---------------------------------------------------------------------------

describe("GET — inventory mode", () => {
  it("calls resolveTenantContexts and loadTenantInventory only — never buildTenantPlan", async () => {
    await GET(makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()));

    expect(mockResolveTenantContexts).toHaveBeenCalledOnce();
    expect(mockLoadTenantInventory).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).not.toHaveBeenCalled();
  });

  it("returns tenant, resolvedTeamCount, and duplicateGroups in the response", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );
    const body = await response.json();

    expect(body.mode).toBe("inventory");
    expect(body.tenant).toBe(TENANT_KEY);
    expect(body.resolvedTeamCount).toBe(11);
    expect(body.duplicateGroups).toEqual([DUPLICATE_GROUP]);
  });

  it("does not include a plan field in inventory mode", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );
    const body = await response.json();

    expect(body.plan).toBeUndefined();
  });

  it("loadTenantInventory is called with the resolved tenant context", async () => {
    await GET(makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()));

    expect(mockLoadTenantInventory).toHaveBeenCalledWith(expect.anything(), TENANT_CONTEXT);
  });
});

// ---------------------------------------------------------------------------
// Dry-run mode — zero writes, reuses buildTenantPlan (the exact CLI logic)
// ---------------------------------------------------------------------------

describe("GET — dry-run mode", () => {
  it("calls resolveTenantContexts, loadTenantInventory, AND buildTenantPlan", async () => {
    await GET(makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()));

    expect(mockResolveTenantContexts).toHaveBeenCalledOnce();
    expect(mockLoadTenantInventory).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).toHaveBeenCalledWith(expect.anything(), INVENTORY);
  });

  it("returns canonical club, teams to move, logo donor, and clubs to archive", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()),
    );
    const body = await response.json();

    expect(body.mode).toBe("dry-run");
    expect(body.tenant).toBe(TENANT_KEY);
    expect(body.resolvedTeamCount).toBe(11);
    expect(body.duplicateGroups).toEqual([DUPLICATE_GROUP]);
    expect(body.plan).toEqual([
      {
        providerClubId: 700,
        canonicalClubId: "club-b",
        clubsToArchive: ["club-a"],
        teamsToMove: 1,
        logoAdoptedFromClubId: null,
      },
    ]);
  });

  it("only ever calls the pure/read-only functions — never a write-capable one", async () => {
    // mockBuildTenantPlan/mockLoadTenantInventory/mockResolveTenantContexts are
    // the ENTIRE set of functions this route imports from the script module
    // (see the "route module shape" tests above) — there is no other
    // function this handler could call to perform a write.
    await GET(makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()));

    expect(mockResolveTenantContexts).toHaveBeenCalledOnce();
    expect(mockLoadTenantInventory).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Dry-run plan fingerprint — CLUB-DIRECTORY-02C-EXEC plan-pinning contract
// ---------------------------------------------------------------------------

describe("GET — dry-run plan fingerprint", () => {
  it("includes a deterministic SHA-256 planFingerprint computed by the shared pure helper", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()),
    );
    const body = await response.json();

    const expected = computePlanFingerprint({
      tenantKey: TENANT_KEY,
      groups: PLAN.groups,
    });

    expect(body.planFingerprint).toBe(expected);
    expect(body.planFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not include a planFingerprint in inventory mode", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );
    const body = await response.json();

    expect(body.planFingerprint).toBeUndefined();
  });

  it("changes when the plan content changes", async () => {
    const changedPlan = {
      tenant: TENANT_CONTEXT,
      groups: [
        { ...PLAN.groups[0], teamsToMove: 999 },
      ],
    };
    mockBuildTenantPlan.mockResolvedValue(changedPlan);

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()),
    );
    const body = await response.json();

    const originalFingerprint = computePlanFingerprint({ tenantKey: TENANT_KEY, groups: PLAN.groups });
    expect(body.planFingerprint).not.toBe(originalFingerprint);
  });
});

// ---------------------------------------------------------------------------
// No credentials, tokens, or raw SFV payloads ever appear in the response
// ---------------------------------------------------------------------------

describe("GET — response never leaks credentials/tokens/raw payloads", () => {
  beforeEach(() => {
    process.env.SFV_APPLICATION_KEY = "super-secret-app-key";
    process.env.SFV_APPLICATION_PASS = "super-secret-app-pass";
    process.env.SFV_TOKEN_URL = "https://sfv.example/token";
    process.env.SFV_CLUB_ID = "483";
  });

  it("inventory response contains no secrets", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain(LEGACY_BEARER);
    expect(json).not.toContain("super-secret-app-key");
    expect(json).not.toContain("super-secret-app-pass");
    expect(json).not.toContain("sfv.example");
    expect(json).not.toMatch(/bearer/i);
    expect(json).not.toContain("SFV_APPLICATION");
    expect(json).not.toContain("SFV_TOKEN_URL");
  });

  it("dry-run response contains no secrets", async () => {
    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "dry-run" }, authHeaders()),
    );
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain(LEGACY_BEARER);
    expect(json).not.toContain("super-secret-app-key");
    expect(json).not.toContain("super-secret-app-pass");
    expect(json).not.toContain("sfv.example");
    expect(json).not.toMatch(/bearer/i);
  });

  it("error responses (401/403/400) contain no secrets either", async () => {
    const responses = await Promise.all([
      GET(makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, { authorization: "Bearer wrong" })),
      GET(makeRequest({ tenant: "other-tenant", mode: "inventory" }, authHeaders())),
      GET(makeRequest({ tenant: TENANT_KEY, mode: "execute" }, authHeaders())),
    ]);

    for (const response of responses) {
      const json = JSON.stringify(await response.json());
      expect(json).not.toContain(LEGACY_BEARER);
      expect(json).not.toContain("super-secret-app-key");
      expect(json).not.toContain("super-secret-app-pass");
    }
  });

  it("unexpected internal error does not leak error details", async () => {
    mockLoadTenantInventory.mockRejectedValue(
      new Error("connection string postgresql://user:supersecret@host/db"),
    );

    const response = await GET(
      makeRequest({ tenant: TENANT_KEY, mode: "inventory" }, authHeaders()),
    );
    const json = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(json).not.toContain("supersecret");
    expect(json).not.toContain("postgresql://");
  });
});
