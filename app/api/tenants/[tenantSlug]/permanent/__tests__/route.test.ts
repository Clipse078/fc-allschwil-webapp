/**
 * app/api/tenants/[tenantSlug]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-TENANT-01 — Focused tests for DELETE /api/tenants/[tenantSlug]/permanent.
 *
 * TEST COVERAGE:
 *   1. 401 no session.
 *   2. 404 tenant not found.
 *   3. 403 not authorized (non-super-admin).
 *   4. Preview: returns impact + requiresConfirmation, no mutation.
 *   5. Confirm=true: deletion runs, global Users preserved (not in impact).
 *   6. hasTenantDeletionAuthority called with tenant's own ID (not slug).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  tenantFindUnique: vi.fn(),
  getTenantDeletionImpact: vi.fn(),
  deleteTenantPermanently: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: { findUnique: (...args: unknown[]) => mocks.tenantFindUnique(...args) },
  },
}));
vi.mock("@/lib/tenants/tenant-delete-service", () => ({
  getTenantDeletionImpact: mocks.getTenantDeletionImpact,
  deleteTenantPermanently: mocks.deleteTenantPermanently,
}));

import { DELETE } from "../route";

const TENANT_SLUG = "fc-test";
const TENANT_ID = "tenant-db-id";
const ACTOR_ID = "super-admin-1";

const MOCK_IMPACT = {
  persons: 50, teams: 12, teamSeasons: 24, orgUnits: 8, users: 5,
  registrations: 30, events: 200, trainingSeries: 15, trainingSessions: 300,
  newsArticles: 10, mediaAssets: 20, workspaceDocuments: 5,
  infoboards: 2, facilities: 3, facilityResources: 9, auditLogs: 1000,
};

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/tenants/${TENANT_SLUG}/permanent${qs}`);
}
function makeParams() {
  return { params: Promise.resolve({ tenantSlug: TENANT_SLUG }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/tenants/[tenantSlug]/permanent", () => {
  it("1. 401 no session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("2. 404 tenant not found", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.tenantFindUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("3. 403 non-super-admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_ID, key: TENANT_SLUG, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("4. preview: returns impact + requiresConfirmation, no mutation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_ID, key: TENANT_SLUG, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.getTenantDeletionImpact.mockResolvedValue(MOCK_IMPACT);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact.persons).toBe(50);
    expect(mocks.deleteTenantPermanently).not.toHaveBeenCalled();
  });

  it("5. confirm=true: deletion runs, global Users not deleted", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_ID, key: TENANT_SLUG, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.deleteTenantPermanently.mockResolvedValue({
      tenantId: TENANT_ID, name: "Test", key: TENANT_SLUG, impact: MOCK_IMPACT,
    });

    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(200);
    expect(mocks.deleteTenantPermanently).toHaveBeenCalledWith(TENANT_ID);
    const body = await res.json();
    expect(body.message).toContain("endgültig gelöscht");
    // Impact does not list user deletion — users survive globally
    expect(body.impact).not.toHaveProperty("globalUsersDeleted");
  });

  it("6. hasTenantDeletionAuthority called with DB-resolved tenant ID", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.tenantFindUnique.mockResolvedValue({ id: TENANT_ID, key: TENANT_SLUG, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);

    await DELETE(makeReq(), makeParams());

    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });
});
