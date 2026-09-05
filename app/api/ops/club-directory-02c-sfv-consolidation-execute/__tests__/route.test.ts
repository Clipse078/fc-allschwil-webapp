/**
 * Tests for POST /api/ops/club-directory-02c-sfv-consolidation-execute
 * CLUB-DIRECTORY-02C-EXEC.
 *
 * Every external dependency (Prisma, the SFV client — transitively, via the
 * scripts module — the durable backup store, and the mutation-capable
 * consolidation service) is mocked. No real database, no real SFV network
 * access, no real credentials, no real Vercel Blob calls.
 *
 * `computePlanFingerprint` (lib/club-directory/plan-fingerprint.ts) is used
 * for real (not mocked) so fingerprint-matching behaviour is exercised
 * end-to-end rather than assumed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computePlanFingerprint } from "@/lib/club-directory/plan-fingerprint";

const mockResolveTenantContexts = vi.fn();
const mockResolveProviderClubIdIndex = vi.fn();
const mockLoadTenantInventoryFromIndex = vi.fn();
const mockBuildTenantPlan = vi.fn();
const mockBuildBackupSnapshot = vi.fn();
const mockRequireApiPermission = vi.fn();

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mockRequireApiPermission,
}));

vi.mock("@/scripts/club-directory-02c-sfv-consolidation", () => ({
  resolveTenantContexts: mockResolveTenantContexts,
  resolveProviderClubIdIndex: mockResolveProviderClubIdIndex,
  loadTenantInventoryFromIndex: mockLoadTenantInventoryFromIndex,
  buildTenantPlan: mockBuildTenantPlan,
  buildBackupSnapshot: mockBuildBackupSnapshot,
  PROVIDER: "SFV",
  EXECUTE_CONFIRMATION: "CONSOLIDATE-CLUB-DIRECTORY",
}));

const mockPersistConsolidationBackupSnapshot = vi.fn();
vi.mock("@/lib/club-directory/ops-backup-storage", () => ({
  persistConsolidationBackupSnapshot: mockPersistConsolidationBackupSnapshot,
}));

const mockConsolidateExternalClubsByProviderIdentity = vi.fn();
vi.mock("@/lib/club-directory/consolidation-service", () => ({
  consolidateExternalClubsByProviderIdentity: mockConsolidateExternalClubsByProviderIdentity,
}));

const mockCreateClubConsolidationDatabase = vi.fn();
vi.mock("@/lib/club-directory/prisma-consolidation-adapter", () => ({
  createClubConsolidationDatabase: mockCreateClubConsolidationDatabase,
}));

const mockExternalClubFindMany = vi.fn();
const mockExternalClubProviderMappingFindMany = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    externalClub: { findMany: (...args: unknown[]) => mockExternalClubFindMany(...args) },
    externalClubProviderMapping: {
      findMany: (...args: unknown[]) => mockExternalClubProviderMappingFindMany(...args),
    },
  },
}));

const routeModule = await import("../route");
const { POST } = routeModule;

const ORIGINAL_ENV = { ...process.env };

const ROUTE_PATH = "http://x/api/ops/club-directory-02c-sfv-consolidation-execute";
const TENANT_KEY = "fc-allschwil";
const LEGACY_BEARER = "test-consolidation-operator-secret";
const CONFIRMATION = "CONSOLIDATE-CLUB-DIRECTORY";

const TENANT_CONTEXT = {
  tenantId: "tenant-fc-allschwil-id",
  tenantKey: TENANT_KEY,
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
};

const INDEX_BY_TEAM_ID = new Map([
  [2001, 700],
  [2002, 700],
  [3001, 555],
  [3002, 555],
]);

const DUPLICATE_GROUPS = [
  { providerClubId: 700, distinctClubIds: ["club-a", "club-b"], teamCount: 2, providerTeamIds: [2001, 2002] },
  { providerClubId: 555, distinctClubIds: ["club-c", "club-d"], teamCount: 2, providerTeamIds: [3001, 3002] },
];

const INVENTORY_BEFORE = {
  tenant: TENANT_CONTEXT,
  resolvedTeamCount: 4,
  duplicateGroups: DUPLICATE_GROUPS,
};

const INVENTORY_AFTER = {
  tenant: TENANT_CONTEXT,
  resolvedTeamCount: 4,
  duplicateGroups: [] as typeof DUPLICATE_GROUPS,
};

const PLAN_GROUPS = [
  { providerClubId: 700, canonicalClubId: "club-b", clubsToArchive: ["club-a"], teamsToMove: 1, logoAdoptedFromClubId: null },
  { providerClubId: 555, canonicalClubId: "club-d", clubsToArchive: ["club-c"], teamsToMove: 1, logoAdoptedFromClubId: "club-c" },
];

const PLAN = { tenant: TENANT_CONTEXT, groups: PLAN_GROUPS };

const EXPECTED_FINGERPRINT = computePlanFingerprint({ tenantKey: TENANT_KEY, groups: PLAN_GROUPS });

const CONSOLIDATION_RESULT = {
  groupsProcessed: 2,
  groupsMerged: 2,
  groupsAlreadyConsolidated: 0,
  teamsMoved: 2,
  clubsArchived: 2,
  details: [
    { status: "merged" as const, providerClubId: 700, canonicalClubId: "club-b", mergedClubIds: ["club-a"], teamsMoved: 1, logoAdoptedFromClubId: null },
    { status: "merged" as const, providerClubId: 555, canonicalClubId: "club-d", mergedClubIds: ["club-c"], teamsMoved: 1, logoAdoptedFromClubId: "club-c" },
  ],
};

const CLUB_ROWS_AFTER = [
  { id: "club-b", tenantId: TENANT_CONTEXT.tenantId, archivedAt: null },
  { id: "club-a", tenantId: TENANT_CONTEXT.tenantId, archivedAt: new Date("2026-08-08T00:00:00.000Z") },
  { id: "club-d", tenantId: TENANT_CONTEXT.tenantId, archivedAt: null },
  { id: "club-c", tenantId: TENANT_CONTEXT.tenantId, archivedAt: new Date("2026-08-08T00:00:00.000Z") },
];

const MAPPING_ROWS_AFTER = [
  { providerClubId: 700, externalClubId: "club-b", tenantId: TENANT_CONTEXT.tenantId },
  { providerClubId: 555, externalClubId: "club-d", tenantId: TENANT_CONTEXT.tenantId },
];

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(ROUTE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(ROUTE_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });
}

function authHeaders(secret = LEGACY_BEARER): Record<string, string> {
  return { authorization: `Bearer ${secret}` };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { confirmation: CONFIRMATION, expectedPlanFingerprint: EXPECTED_FINGERPRINT, ...overrides };
}

function setStageEnvironment(): void {
  process.env.NODE_ENV = "production";
  process.env.APP_ENV = "stage";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
}

function setupHappyPathMocks(): void {
  mockResolveTenantContexts.mockResolvedValue([TENANT_CONTEXT]);
  mockResolveProviderClubIdIndex.mockResolvedValue({ indexByTeamId: INDEX_BY_TEAM_ID });
  mockLoadTenantInventoryFromIndex
    .mockResolvedValueOnce(INVENTORY_BEFORE)
    .mockResolvedValueOnce(INVENTORY_AFTER);
  mockBuildTenantPlan.mockResolvedValue(PLAN);
  mockBuildBackupSnapshot.mockResolvedValue({ generatedAt: "2026-08-08T00:00:00.000Z", tenants: [] });
  mockPersistConsolidationBackupSnapshot.mockResolvedValue({
    ok: true,
    url: "https://blob.example/ops-backups/a.json",
    pathname: "ops-backups/club-directory-02c-sfv-consolidation/fc-allschwil-x.json",
  });
  mockCreateClubConsolidationDatabase.mockReturnValue({ fake: "consolidation-database" });
  mockConsolidateExternalClubsByProviderIdentity.mockResolvedValue(CONSOLIDATION_RESULT);
  mockExternalClubFindMany.mockResolvedValue(CLUB_ROWS_AFTER);
  mockExternalClubProviderMappingFindMany.mockResolvedValue(MAPPING_ROWS_AFTER);
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
  setupHappyPathMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ---------------------------------------------------------------------------
// Route module shape — POST only, no parallel mutation logic
// ---------------------------------------------------------------------------

describe("route module shape", () => {
  it("exports only POST — no GET/PUT/PATCH/DELETE handler exists", () => {
    expect(typeof routeModule.POST).toBe("function");
    expect((routeModule as Record<string, unknown>).GET).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PATCH).toBeUndefined();
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined();
  });

  it("never imports runSfvClubConsolidationForTenant (would re-fetch SFV a second time)", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts"),
      "utf-8",
    );
    const code = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toContain("runSfvClubConsolidationForTenant");
    expect(code).not.toMatch(/from\s+["']@\/lib\/integrations\/sfv\/sync\/club-consolidation["']/);
  });

  it("reuses the shared plan-building functions and the real consolidation service — no parallel mutation logic", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts"),
      "utf-8",
    );

    expect(content).toContain("@/scripts/club-directory-02c-sfv-consolidation");
    expect(content).toContain("resolveTenantContexts");
    expect(content).toContain("resolveProviderClubIdIndex");
    expect(content).toContain("loadTenantInventoryFromIndex");
    expect(content).toContain("buildTenantPlan");
    expect(content).toContain("consolidateExternalClubsByProviderIdentity");
    expect(content).toContain("@/lib/club-directory/consolidation-service");
    expect(content).toContain("createClubConsolidationDatabase");
  });

  it("does not read a tenant identifier from the request at all", () => {
    const content = readFileSync(
      resolve(process.cwd(), "app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts"),
      "utf-8",
    );

    expect(content).not.toMatch(/body\.tenant/);
    expect(content).not.toMatch(/searchParams\.get\(\s*["']tenant["']\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// STAGE-only guard
// ---------------------------------------------------------------------------

describe("POST — STAGE-only guard", () => {
  it("rejects with 403 when APP_ENV is not stage (local)", async () => {
    process.env.APP_ENV = "local";

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("rejects with 403 when APP_ENV is prod", async () => {
    process.env.APP_ENV = "prod";

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(403);
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("rejects with 403 when APP_ENV is unset (defaults to local)", async () => {
    delete process.env.APP_ENV;

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(403);
  });

  it("does not leak whether auth/confirmation would have succeeded when blocked by the STAGE guard", async () => {
    process.env.APP_ENV = "prod";

    const response = await POST(makeRequest(validBody(), authHeaders(LEGACY_BEARER)));

    expect(response.status).toBe(403);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("POST — authentication", () => {
  it("rejects an unauthenticated request with 401", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const response = await POST(makeRequest(validBody()));
    expect(response.status).toBe(401);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("rejects an ordinary tenant Club Admin with 403", async () => {
    mockRequireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "club-admin" } },
    });

    const response = await POST(makeRequest(validBody()));

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

    const response = await POST(
      makeRequest(validBody(), authHeaders("routine-cron-secret")),
    );

    expect(response.status).toBe(401);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("requires the existing platform-only tenants.manage permission", async () => {
    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      "tenants.manage",
    );
  });
});

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

describe("POST — request body parsing", () => {
  it("rejects invalid JSON with 400 before any tenant/DB access", async () => {
    const response = await POST(makeRawRequest("{not-json", authHeaders()));

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects a missing body with 400", async () => {
    const response = await POST(makeRawRequest("", authHeaders()));

    expect(response.status).toBe(400);
  });

  it("rejects a non-object JSON body (array) with 400", async () => {
    const response = await POST(makeRawRequest("[]", authHeaders()));

    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Confirmation contract
// ---------------------------------------------------------------------------

describe("POST — confirmation contract", () => {
  it("rejects with 400 when confirmation is missing", async () => {
    const response = await POST(
      makeRequest({ expectedPlanFingerprint: EXPECTED_FINGERPRINT }, authHeaders()),
    );

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it.each([
    "consolidate-club-directory",
    "CONSOLIDATE-CLUB-DIRECTORY ",
    " CONSOLIDATE-CLUB-DIRECTORY",
    "CONSOLIDATE-CLUB-DIRECTORY-EXTRA",
    "CONSOLIDATE_CLUB_DIRECTORY",
    "confirm",
    "",
  ])("rejects an incorrect confirmation value %j with 400 and zero mutations", async (confirmation) => {
    const response = await POST(makeRequest(validBody({ confirmation }), authHeaders()));

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("accepts the exact confirmation token", async () => {
    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Plan fingerprint contract
// ---------------------------------------------------------------------------

describe("POST — plan fingerprint contract", () => {
  it("rejects with 400 when expectedPlanFingerprint is missing", async () => {
    const response = await POST(makeRequest({ confirmation: CONFIRMATION }, authHeaders()));

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("rejects with 400 when expectedPlanFingerprint is an empty string", async () => {
    const response = await POST(
      makeRequest(validBody({ expectedPlanFingerprint: "" }), authHeaders()),
    );

    expect(response.status).toBe(400);
    expect(mockResolveTenantContexts).not.toHaveBeenCalled();
  });

  it("rejects with 400 when expectedPlanFingerprint is not a string", async () => {
    const response = await POST(
      makeRequest(validBody({ expectedPlanFingerprint: 12345 }), authHeaders()),
    );

    expect(response.status).toBe(400);
  });

  it("aborts with 409 and ZERO mutations when the regenerated plan's fingerprint does not match", async () => {
    const response = await POST(
      makeRequest(validBody({ expectedPlanFingerprint: "0".repeat(64) }), authHeaders()),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(mockBuildBackupSnapshot).not.toHaveBeenCalled();
    expect(mockPersistConsolidationBackupSnapshot).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
    expect(body.actualPlanFingerprint).toBe(EXPECTED_FINGERPRINT);
  });

  it("aborts with zero mutations when the regenerated plan CHANGED (e.g. one more team to move)", async () => {
    const driftedPlan = {
      tenant: TENANT_CONTEXT,
      groups: [{ ...PLAN_GROUPS[0], teamsToMove: 2 }, PLAN_GROUPS[1]],
    };
    mockBuildTenantPlan.mockResolvedValue(driftedPlan);

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(409);
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("regenerates the plan from LIVE data rather than trusting the request body", async () => {
    await POST(makeRequest(validBody({ plan: [{ fake: "injected-plan-should-be-ignored" }] }), authHeaders()));

    expect(mockResolveProviderClubIdIndex).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).toHaveBeenCalledOnce();
    expect(mockBuildTenantPlan).toHaveBeenCalledWith(expect.anything(), INVENTORY_BEFORE);
  });
});

// ---------------------------------------------------------------------------
// Fixed tenant
// ---------------------------------------------------------------------------

describe("POST — fixed tenant (fc-allschwil only, never accepted from the request)", () => {
  it("always resolves the hard-coded tenant regardless of any tenant-like field in the body", async () => {
    await POST(makeRequest(validBody({ tenant: "some-other-tenant" }), authHeaders()));

    expect(mockResolveTenantContexts).toHaveBeenCalledWith(expect.anything(), "fc-allschwil");
  });

  it("returns 404 when no enabled SFV configuration exists for fc-allschwil", async () => {
    mockResolveTenantContexts.mockResolvedValue([]);

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(404);
    expect(mockResolveProviderClubIdIndex).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Backup-before-mutation guard
// ---------------------------------------------------------------------------

describe("POST — backup before mutation", () => {
  it("persists the backup before calling the mutation service", async () => {
    const order: string[] = [];
    mockPersistConsolidationBackupSnapshot.mockImplementation(async () => {
      order.push("backup");
      return { ok: true, url: "https://blob.example/x.json", pathname: "x.json" };
    });
    mockConsolidateExternalClubsByProviderIdentity.mockImplementation(async () => {
      order.push("mutate");
      return CONSOLIDATION_RESULT;
    });

    await POST(makeRequest(validBody(), authHeaders()));

    expect(order).toEqual(["backup", "mutate"]);
  });

  it("aborts with zero mutations when the backup cannot be persisted (storage not configured)", async () => {
    mockPersistConsolidationBackupSnapshot.mockResolvedValue({
      ok: false,
      status: 503,
      error: "Backup-Speicher ist nicht konfiguriert.",
    });

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("BLOB_READ_WRITE_TOKEN");
  });

  it("aborts with zero mutations when the backup upload fails unexpectedly", async () => {
    mockPersistConsolidationBackupSnapshot.mockResolvedValue({
      ok: false,
      status: 500,
      error: "Backup konnte nicht gespeichert werden.",
    });

    const response = await POST(makeRequest(validBody(), authHeaders()));

    expect(response.status).toBe(500);
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Nothing to consolidate
// ---------------------------------------------------------------------------

describe("POST — nothing to consolidate", () => {
  it("performs zero mutations and returns 200 when the regenerated plan has no groups", async () => {
    const emptyInventory = { tenant: TENANT_CONTEXT, resolvedTeamCount: 4, duplicateGroups: [] };
    const emptyPlan = { tenant: TENANT_CONTEXT, groups: [] };
    mockLoadTenantInventoryFromIndex.mockReset().mockResolvedValue(emptyInventory);
    mockBuildTenantPlan.mockResolvedValue(emptyPlan);
    const emptyFingerprint = computePlanFingerprint({ tenantKey: TENANT_KEY, groups: [] });

    const response = await POST(
      makeRequest(validBody({ expectedPlanFingerprint: emptyFingerprint }), authHeaders()),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mutated).toBe(false);
    expect(mockBuildBackupSnapshot).not.toHaveBeenCalled();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Exact existing consolidation service used — no parallel mutation logic
// ---------------------------------------------------------------------------

describe("POST — exact existing consolidation service used", () => {
  it("calls createClubConsolidationDatabase(prisma) then consolidateExternalClubsByProviderIdentity with the SAME already-fetched index", async () => {
    await POST(makeRequest(validBody(), authHeaders()));

    expect(mockCreateClubConsolidationDatabase).toHaveBeenCalledOnce();
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledOnce();
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledWith(
      { fake: "consolidation-database" },
      { tenantId: TENANT_CONTEXT.tenantId, provider: "SFV", resolvedClubIdsByTeamId: INDEX_BY_TEAM_ID },
    );
  });

  it("fetches SFV exactly ONCE for the whole request (no second fetch for the mutation itself)", async () => {
    await POST(makeRequest(validBody(), authHeaders()));

    expect(mockResolveProviderClubIdIndex).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Success path + postcondition
// ---------------------------------------------------------------------------

describe("POST — success path", () => {
  it("returns 200 with the execution report on success", async () => {
    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mutated).toBe(true);
    expect(body.tenant).toEqual({ tenantKey: TENANT_KEY });
    expect(body.planFingerprint).toBe(EXPECTED_FINGERPRINT);
    expect(body.consolidation).toEqual({
      groupsProcessed: 2,
      groupsMerged: 2,
      groupsAlreadyConsolidated: 0,
      teamsMoved: 2,
      clubsArchived: 2,
    });
    expect(body.backup.pathname).toBe(
      "ops-backups/club-directory-02c-sfv-consolidation/fc-allschwil-x.json",
    );
  });

  it("verifies the postcondition and reports it as ok when the DB reflects the expected end state", async () => {
    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(body.postcondition.ok).toBe(true);
    expect(body.postcondition.duplicateGroupsRemaining).toBe(0);
    expect(body.postcondition.canonicalClubsActive).toBe(true);
    expect(body.postcondition.losingClubsArchivedNotDeleted).toBe(true);
    expect(body.postcondition.providerMappingsValid).toBe(true);
    expect(body.postcondition.tenantIsolationIntact).toBe(true);
  });

  it("flags postcondition failure when a duplicate group still remains after execution", async () => {
    mockLoadTenantInventoryFromIndex.mockReset();
    mockLoadTenantInventoryFromIndex
      .mockResolvedValueOnce(INVENTORY_BEFORE)
      .mockResolvedValueOnce({ ...INVENTORY_AFTER, duplicateGroups: [DUPLICATE_GROUPS[0]] });

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.postcondition.ok).toBe(false);
    expect(body.postcondition.duplicateGroupsRemaining).toBe(1);
  });

  it("flags postcondition failure when a canonical club ended up archived", async () => {
    mockExternalClubFindMany.mockResolvedValue([
      { id: "club-b", tenantId: TENANT_CONTEXT.tenantId, archivedAt: new Date() },
      { id: "club-a", tenantId: TENANT_CONTEXT.tenantId, archivedAt: new Date() },
      { id: "club-d", tenantId: TENANT_CONTEXT.tenantId, archivedAt: null },
      { id: "club-c", tenantId: TENANT_CONTEXT.tenantId, archivedAt: new Date() },
    ]);

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(body.postcondition.ok).toBe(false);
    expect(body.postcondition.canonicalClubsActive).toBe(false);
  });

  it("flags a tenant-isolation issue if a provider mapping unexpectedly belongs to another tenant", async () => {
    mockExternalClubProviderMappingFindMany.mockResolvedValue([
      { providerClubId: 700, externalClubId: "club-b", tenantId: "some-other-tenant-id" },
      { providerClubId: 555, externalClubId: "club-d", tenantId: TENANT_CONTEXT.tenantId },
    ]);

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(body.postcondition.ok).toBe(false);
    expect(body.postcondition.tenantIsolationIntact).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency — a repeated request after success performs no destructive work
// ---------------------------------------------------------------------------

describe("POST — idempotency", () => {
  it("a second call with the SAME (now-stale) expectedPlanFingerprint aborts with zero mutations", async () => {
    const first = await POST(makeRequest(validBody(), authHeaders()));
    expect(first.status).toBe(200);
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledOnce();

    // Simulate the post-consolidation world: the plan the SAME
    // expectedPlanFingerprint was pinned against no longer exists — the
    // regenerated live plan is now empty.
    vi.clearAllMocks();
    setupHappyPathMocks();
    const consolidatedInventory = { tenant: TENANT_CONTEXT, resolvedTeamCount: 4, duplicateGroups: [] };
    const consolidatedPlan = { tenant: TENANT_CONTEXT, groups: [] };
    mockLoadTenantInventoryFromIndex.mockReset().mockResolvedValue(consolidatedInventory);
    mockBuildTenantPlan.mockResolvedValue(consolidatedPlan);

    const second = await POST(makeRequest(validBody(), authHeaders()));
    const secondBody = await second.json();

    expect(second.status).toBe(409);
    expect(secondBody.actualPlanFingerprint).not.toBe(EXPECTED_FINGERPRINT);
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
    expect(mockBuildBackupSnapshot).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// No credential leakage
// ---------------------------------------------------------------------------

describe("POST — no credential leakage", () => {
  beforeEach(() => {
    process.env.SFV_APPLICATION_KEY = "super-secret-app-key";
    process.env.SFV_APPLICATION_PASS = "super-secret-app-pass";
    process.env.SFV_TOKEN_URL = "https://sfv.example/token";
    process.env.DATABASE_URL = "postgresql://user:supersecret@host/db";
    process.env.BLOB_READ_WRITE_TOKEN = "super-secret-blob-token";
  });

  it("success response contains no secrets", async () => {
    const response = await POST(makeRequest(validBody(), authHeaders()));
    const json = JSON.stringify(await response.json());

    expect(json).not.toContain(LEGACY_BEARER);
    expect(json).not.toContain("super-secret-app-key");
    expect(json).not.toContain("super-secret-app-pass");
    expect(json).not.toContain("sfv.example");
    expect(json).not.toContain("supersecret");
    expect(json).not.toContain("super-secret-blob-token");
    expect(json).not.toMatch(/bearer/i);
  });

  it("error responses (401/403/400/409) contain no secrets", async () => {
    const responses = await Promise.all([
      POST(makeRequest(validBody(), { authorization: "Bearer wrong" })),
      POST(makeRequest(validBody({ confirmation: "wrong" }), authHeaders())),
      POST(makeRequest(validBody({ expectedPlanFingerprint: "0".repeat(64) }), authHeaders())),
    ]);

    for (const response of responses) {
      const json = JSON.stringify(await response.json());
      expect(json).not.toContain(LEGACY_BEARER);
      expect(json).not.toContain("super-secret-app-key");
      expect(json).not.toContain("super-secret-app-pass");
      expect(json).not.toContain("super-secret-blob-token");
      expect(json).not.toContain("supersecret");
    }
  });

  it("unexpected internal error does not leak error details", async () => {
    mockResolveTenantContexts.mockRejectedValue(
      new Error("connection string postgresql://user:supersecret@host/db"),
    );

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const json = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(json).not.toContain("supersecret");
    expect(json).not.toContain("postgresql://");
  });

  it("mid-execution failure response contains no secrets either", async () => {
    mockConsolidateExternalClubsByProviderIdentity.mockRejectedValue(
      new Error("connection string postgresql://user:supersecret@host/db"),
    );

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const json = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(json).not.toContain("supersecret");
    expect(json).not.toContain("postgresql://");
    expect(json).not.toContain(LEGACY_BEARER);
    expect(json).not.toContain("super-secret-blob-token");
  });
});

// ---------------------------------------------------------------------------
// Mid-execution failure reporting (CLUB-DIRECTORY-02C-EXEC-C1 FIX 2) —
// distinguishing "failed before any mutation" from "failed after mutation
// processing started, partial completion possible".
// ---------------------------------------------------------------------------

describe("POST — mid-execution failure reporting", () => {
  it("a pre-mutation failure (before the mutation phase) reports mutationStarted: false, never true", async () => {
    mockResolveTenantContexts.mockRejectedValue(new Error("boom before mutation"));

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.mutationStarted).toBe(false);
    expect(body.partialCompletionPossible).toBeUndefined();
  });

  it("the plan-fingerprint-mismatch response (already zero mutations) also states mutationStarted: false", async () => {
    const response = await POST(
      makeRequest(validBody({ expectedPlanFingerprint: "0".repeat(64) }), authHeaders()),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.mutationStarted).toBe(false);
  });

  it("a backup-persistence failure (already zero mutations) also states mutationStarted: false", async () => {
    mockPersistConsolidationBackupSnapshot.mockResolvedValue({
      ok: false,
      status: 503,
      error: "Backup-Speicher ist nicht konfiguriert.",
    });

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.mutationStarted).toBe(false);
  });

  it("an exception thrown by consolidateExternalClubsByProviderIdentity is reported as a partial-completion-possible failure, not a generic error", async () => {
    mockConsolidateExternalClubsByProviderIdentity.mockRejectedValue(
      new Error("later group's transaction failed"),
    );

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Consolidation execution failed after mutation processing started.");
    expect(body.mutationStarted).toBe(true);
    expect(body.partialCompletionPossible).toBe(true);
    expect(body.backup).toEqual({
      pathname: "ops-backups/club-directory-02c-sfv-consolidation/fc-allschwil-x.json",
    });
    expect(body.nextAction).toMatch(/inventory/i);
    expect(body.nextAction).toMatch(/dry-run/i);
  });

  it("an exception thrown during postcondition verification (after mutation already ran) is ALSO reported as partial-completion-possible, never a bare 200/generic error", async () => {
    mockExternalClubFindMany.mockRejectedValue(new Error("read failure during postcondition check"));

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.mutationStarted).toBe(true);
    expect(body.partialCompletionPossible).toBe(true);
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledOnce();
  });

  it("never reports partialCompletionPossible for any failure that happens before the mutation phase", async () => {
    mockLoadTenantInventoryFromIndex.mockReset().mockRejectedValue(new Error("SFV fetch decoding failed"));

    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.mutationStarted).toBe(false);
    expect(body.partialCompletionPossible).toBeUndefined();
    expect(mockConsolidateExternalClubsByProviderIdentity).not.toHaveBeenCalled();
  });

  it("does not affect the happy-path success response shape (no mutationStarted/partialCompletionPossible noise on success)", async () => {
    const response = await POST(makeRequest(validBody(), authHeaders()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mutated).toBe(true);
    expect(body.partialCompletionPossible).toBeUndefined();
  });

  it("retry/idempotency behaviour is unaffected: a second call after a mid-execution failure still regenerates and re-fingerprints the plan live", async () => {
    mockConsolidateExternalClubsByProviderIdentity.mockRejectedValueOnce(new Error("transient failure"));

    const first = await POST(makeRequest(validBody(), authHeaders()));
    expect(first.status).toBe(500);
    const firstBody = await first.json();
    expect(firstBody.mutationStarted).toBe(true);

    // A second attempt (e.g. after the operator re-runs inventory/dry-run and
    // re-confirms) still goes through the exact same live plan regeneration
    // and fingerprint check — no special-cased "retry" code path exists.
    vi.clearAllMocks();
    setupHappyPathMocks();
    const second = await POST(makeRequest(validBody(), authHeaders()));
    expect(second.status).toBe(200);
    expect(mockResolveProviderClubIdIndex).toHaveBeenCalledOnce();
    expect(mockConsolidateExternalClubsByProviderIdentity).toHaveBeenCalledOnce();
  });
});
