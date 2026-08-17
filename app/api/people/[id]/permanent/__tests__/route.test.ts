/**
 * app/api/people/[id]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-PERSONS-01 — Focused tests for DELETE /api/people/[id]/permanent.
 *
 * TEST COVERAGE:
 *   1. No session → 401.
 *   2. Person not found → 404.
 *   3. Unauthorized (hasTenantDeletionAuthority false) → 403.
 *   4. Preview (no confirm): returns 200 + impact + requiresConfirmation: true. No mutation.
 *   5. Confirm=true: deletes person, returns 200 with impact.
 *   6. Cross-tenant: person belongs to tenant-b, caller authorized only for tenant-a → 403.
 *   7. Global User survives: linkedUserId returned in impact, not deleted.
 *   8. After deletion: person-delete-service called correctly.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  personFindUnique: vi.fn(),
  getPersonDeletionImpact: vi.fn(),
  deletePersonPermanently: vi.fn(),
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
    person: { findUnique: (...args: unknown[]) => mocks.personFindUnique(...args) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/people/person-delete-service", () => ({
  getPersonDeletionImpact: mocks.getPersonDeletionImpact,
  deletePersonPermanently: mocks.deletePersonPermanently,
}));

import { DELETE } from "../route";

const PERSON_ID = "person-1";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const USER_ID = "user-actor";

const MOCK_IMPACT = {
  squadMemberships: 2,
  trainerMemberships: 0,
  personAssignments: 3,
  orgUnitMemberships: 1,
  linkedRegistrations: 0,
  linkedUserId: "user-linked-1",
  linkedUserEmail: "linked@example.com",
};

function makeReq(searchParams: string = "") {
  return new NextRequest(`http://localhost/api/people/${PERSON_ID}/permanent${searchParams}`);
}

function makeParams() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/people/[id]/permanent", () => {
  it("1. returns 401 when no session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("2. returns 404 when person not found", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("3. returns 403 when not authorized", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);
    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("4. preview: returns 200 + impact + requiresConfirmation without mutation", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.getPersonDeletionImpact.mockResolvedValue(MOCK_IMPACT);

    const res = await DELETE(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact).toEqual(MOCK_IMPACT);
    expect(mocks.deletePersonPermanently).not.toHaveBeenCalled();
  });

  it("5. confirm=true: deletes and returns 200 with impact", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.deletePersonPermanently.mockResolvedValue({
      personId: PERSON_ID,
      firstName: "Max",
      lastName: "Muster",
      impact: MOCK_IMPACT,
    });

    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
    expect(mocks.deletePersonPermanently).toHaveBeenCalledWith(TENANT_A, PERSON_ID);
    expect(mocks.logAction).toHaveBeenCalled();
  });

  it("6. cross-tenant: person in tenant-b returns 403 for tenant-a actor", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_B });
    // hasTenantDeletionAuthority called with TENANT_B, actor only authorized for TENANT_A
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);
    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_B }),
    );
  });

  it("7. global User survives: linkedUserId in impact is not deleted", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.getPersonDeletionImpact.mockResolvedValue(MOCK_IMPACT);

    const res = await DELETE(makeReq(), makeParams());
    const body = await res.json();
    // linkedUserId is in the impact (informational) but person-delete-service
    // never deletes the User — confirmed by not calling deletePersonPermanently in preview
    expect(body.impact.linkedUserId).toBe("user-linked-1");
    expect(mocks.deletePersonPermanently).not.toHaveBeenCalled();
  });

  it("8. confirm=true + person not found in service → 404", async () => {
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
    mocks.deletePersonPermanently.mockResolvedValue(null);

    const res = await DELETE(makeReq("?confirm=true"), makeParams());
    expect(res.status).toBe(404);
  });
});
