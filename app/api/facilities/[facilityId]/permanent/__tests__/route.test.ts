/**
 * app/api/facilities/[facilityId]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-FACILITIES-01 — Focused tests for DELETE /api/facilities/[facilityId]/permanent.
 *
 * TEST COVERAGE:
 *   1. 401 no session.
 *   2. 404 facility not found.
 *   3. 403 not authorized.
 *   4. Preview: returns impact + requiresConfirmation, no mutation.
 *   5. Confirm=true: deletion runs, planning history preserved (allocation count in impact).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  facilityFindUnique: vi.fn(),
  getFacilityDeletionImpact: vi.fn(),
  deleteFacilityPermanently: vi.fn(),
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
    facility: { findUnique: (...args: unknown[]) => mocks.facilityFindUnique(...args) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/facilities/facility-delete-service", () => ({
  getFacilityDeletionImpact: mocks.getFacilityDeletionImpact,
  deleteFacilityPermanently: mocks.deleteFacilityPermanently,
}));

import { DELETE } from "../route";

const FACILITY_ID = "facility-1";
const TENANT_ID = "tenant-a";
const ACTOR_ID = "actor-1";
const MOCK_IMPACT = { resources: 3, totalAllocationRefs: 12 };

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/facilities/${FACILITY_ID}/permanent${qs}`);
}
function makeParams() {
  return { params: Promise.resolve({ facilityId: FACILITY_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/facilities/[facilityId]/permanent", () => {
  it("1. 401 no session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await DELETE(makeReq(), makeParams())).status).toBe(401);
  });

  it("2. 404 facility not found", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.facilityFindUnique.mockResolvedValue(null);
    expect((await DELETE(makeReq(), makeParams())).status).toBe(404);
  });

  it("3. 403 not authorized", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.facilityFindUnique.mockResolvedValue({ id: FACILITY_ID, tenantId: TENANT_ID, name: "Spielfeld" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);
    expect((await DELETE(makeReq(), makeParams())).status).toBe(403);
  });

  it("4. preview: returns impact + requiresConfirmation, no mutation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.facilityFindUnique.mockResolvedValue({ id: FACILITY_ID, tenantId: TENANT_ID, name: "Spielfeld" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.getFacilityDeletionImpact.mockResolvedValue(MOCK_IMPACT);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact.resources).toBe(3);
    expect(mocks.deleteFacilityPermanently).not.toHaveBeenCalled();
  });

  it("5. confirm=true: deletion with planning history preserved (in impact as refs)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.facilityFindUnique.mockResolvedValue({ id: FACILITY_ID, tenantId: TENANT_ID, name: "Spielfeld" });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.deleteFacilityPermanently.mockResolvedValue({
      facilityId: FACILITY_ID, name: "Spielfeld", impact: MOCK_IMPACT,
    });

    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(200);
    expect(mocks.deleteFacilityPermanently).toHaveBeenCalledWith(TENANT_ID, FACILITY_ID);
    const body = await res.json();
    // totalAllocationRefs shows planning history existed (links removed, not planning data)
    expect(body.impact.totalAllocationRefs).toBe(12);
  });
});
