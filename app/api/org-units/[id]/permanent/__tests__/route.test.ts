/**
 * app/api/org-units/[id]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-ORG-01 — Focused tests for DELETE /api/org-units/[id]/permanent.
 *
 * TEST COVERAGE:
 *   1. 401 when no session.
 *   2. 404 when OrgUnit not found.
 *   3. 403 when not authorized.
 *   4. Preview: returns impact + requiresConfirmation, no mutation.
 *   5. Confirm=true: deletes, Persons/Teams/TeamSeasons survive (not in impact as deletions).
 *   6. Tenant safety: hasTenantDeletionAuthority called with correct tenantId.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  orgUnitFindUnique: vi.fn(),
  getOrgUnitDeletionImpact: vi.fn(),
  deleteOrgUnitPermanently: vi.fn(),
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
    orgUnit: { findUnique: (...args: unknown[]) => mocks.orgUnitFindUnique(...args) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/org-units/orgunit-delete-service", () => ({
  getOrgUnitDeletionImpact: mocks.getOrgUnitDeletionImpact,
  deleteOrgUnitPermanently: mocks.deleteOrgUnitPermanently,
}));

import { DELETE } from "../route";

const OU_ID = "ou-1";
const TENANT_A = "tenant-a";
const USER_ID = "actor-1";

const MOCK_IMPACT = {
  childOrgUnits: 0,
  teamSeasonLinks: 2,
  orgUnitMemberships: 5,
  personAssignments: 3,
  scopedUserRoles: 1,
  legacyTeamLinks: 1,
};

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/org-units/${OU_ID}/permanent${qs}`);
}
function makeParams() {
  return { params: Promise.resolve({ id: OU_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/org-units/[id]/permanent", () => {
  it("1. 401 no session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("2. 404 OrgUnit not found", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, activeTenantId: TENANT_A } });
    mocks.orgUnitFindUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("3. 403 not authorized", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, activeTenantId: TENANT_A } });
    mocks.orgUnitFindUnique.mockResolvedValue({ id: OU_ID, tenantId: TENANT_A, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("4. preview returns impact + requiresConfirmation, no mutation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, activeTenantId: TENANT_A } });
    mocks.orgUnitFindUnique.mockResolvedValue({ id: OU_ID, tenantId: TENANT_A, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.getOrgUnitDeletionImpact.mockResolvedValue(MOCK_IMPACT);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact).toEqual(MOCK_IMPACT);
    expect(mocks.deleteOrgUnitPermanently).not.toHaveBeenCalled();
  });

  it("5. confirm=true: deletes. Persons/Teams/TeamSeasons not listed as deleted.", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, activeTenantId: TENANT_A } });
    mocks.orgUnitFindUnique.mockResolvedValue({ id: OU_ID, tenantId: TENANT_A, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.deleteOrgUnitPermanently.mockResolvedValue({
      orgUnitId: OU_ID,
      name: "Test",
      key: "test",
      impact: MOCK_IMPACT,
    });

    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(200);
    expect(mocks.deleteOrgUnitPermanently).toHaveBeenCalledWith(TENANT_A, OU_ID);
    // Persons and Teams are not in the deleted impact — they survive.
    const body = await res.json();
    expect(body.impact).not.toHaveProperty("persons");
    expect(body.impact).not.toHaveProperty("teams");
  });

  it("6. hasTenantDeletionAuthority called with correct tenantId from DB", async () => {
    const TENANT_DB = "tenant-from-db";
    mocks.auth.mockResolvedValue({ user: { id: USER_ID, activeTenantId: "tenant-session" } });
    mocks.orgUnitFindUnique.mockResolvedValue({ id: OU_ID, tenantId: TENANT_DB, name: "Test" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);

    await DELETE(makeReq(), makeParams());

    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_DB }),
    );
  });
});
