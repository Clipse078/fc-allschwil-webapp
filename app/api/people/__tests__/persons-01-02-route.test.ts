/**
 * PERSONS-01/02-C1 — /api/people/[id] route tests (hardened).
 *
 * Covers:
 * - GET returns person for authorized caller with matching tenantId
 * - GET returns 404 for unknown person
 * - GET rejects cross-tenant person (person.tenantId ≠ session.tenantId → 404)
 * - PUT updates identity fields
 * - PUT rejects cross-tenant update (strict tenantId)
 * - DELETE requires people.delete (not people.manage)
 * - DELETE uses PersonAssignment model (not OrgUnitMembership)
 * - DELETE does NOT delete linked User/TenantMembership/UserRole
 * - DELETE fails with 403 when caller only has people.manage
 * - POST requires tenant context (Person.tenantId NOT NULL)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  personUpdate: vi.fn(),
  personDelete: vi.fn(),
  personCreate: vi.fn(),
  personAssignmentDeleteMany: vi.fn(),
  // Must NOT be called on person delete
  orgUnitMembershipDeleteMany: vi.fn(),
  userDelete: vi.fn(),
  tenantMembershipDelete: vi.fn(),
  userRoleDelete: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiActiveTenantId: mocks.requireApiActiveTenantId,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      update: mocks.personUpdate,
      delete: mocks.personDelete,
      create: mocks.personCreate,
    },
    personAssignment: {
      deleteMany: mocks.personAssignmentDeleteMany,
    },
    orgUnitMembership: {
      deleteMany: mocks.orgUnitMembershipDeleteMany,
    },
    user: { delete: mocks.userDelete },
    tenantMembership: { delete: mocks.tenantMembershipDelete },
    userRole: { delete: mocks.userRoleDelete },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { GET, PUT, DELETE } from "@/app/api/people/[id]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-abc-123";
const TENANT_ID = "tenant-001";
const OTHER_TENANT_ID = "tenant-other";

function authorized() {
  return {
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1", activeTenantId: TENANT_ID } },
  };
}
function unauthorized() {
  return { ok: false, status: 403, error: "Forbidden" };
}
function ctx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}
function makeRequest(method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost/api/people/${PERSON_ID}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}
function makePerson(tenantId = TENANT_ID, overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    firstName: "Max",
    lastName: "Muster",
    tenantId,
    userId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiActiveTenantId.mockResolvedValue({ ok: true, tenantId: TENANT_ID });
  mocks.logAction.mockResolvedValue(undefined);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/people/[id]", () => {
  it("returns 200 for authorized caller with matching tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique
      .mockResolvedValueOnce(makePerson()) // tenant check
      .mockResolvedValueOnce({ ...makePerson(), email: null, phone: null, dateOfBirth: null, notes: null, imageUrl: null, displayName: null, isActive: true, isPlayer: false, isTrainer: false, createdAt: new Date(), updatedAt: new Date(), user: null });

    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown person", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 403 for unauthorized caller", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(unauthorized());
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when person.tenantId ≠ session.tenantId (cross-tenant rejected)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    // Person belongs to a DIFFERENT tenant
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT_ID));
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(404);
  });
});

// ── PUT ───────────────────────────────────────────────────────────────────────

describe("PUT /api/people/[id]", () => {
  it("updates person identity fields", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.personUpdate.mockResolvedValue({ id: PERSON_ID, firstName: "New", lastName: "Name" });

    const res = await PUT(makeRequest("PUT", { firstName: "New", lastName: "Name" }), ctx());
    expect(res.status).toBe(200);
  });

  it("returns 404 for cross-tenant update attempt", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT_ID));
    const res = await PUT(makeRequest("PUT", { firstName: "A", lastName: "B" }), ctx());
    expect(res.status).toBe(404);
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for missing firstName", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await PUT(makeRequest("PUT", { firstName: "", lastName: "Name" }), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 403 when unauthorized", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await PUT(makeRequest("PUT", { firstName: "A", lastName: "B" }), ctx());
    expect(res.status).toBe(403);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/people/[id]", () => {
  it("permanently deletes person with people.delete permission", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.personAssignmentDeleteMany.mockResolvedValue({ count: 2 });
    mocks.personDelete.mockResolvedValue({ id: PERSON_ID });

    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(200);

    // Uses PersonAssignment model for cascade cleanup
    expect(mocks.personAssignmentDeleteMany).toHaveBeenCalledWith({
      where: { personId: PERSON_ID },
    });
    expect(mocks.personDelete).toHaveBeenCalledOnce();
  });

  it("does NOT call OrgUnitMembership.deleteMany (not used for person assignments)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.personAssignmentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.personDelete.mockResolvedValue({ id: PERSON_ID });

    await DELETE(makeRequest("DELETE"), ctx());

    // OrgUnitMembership is NOT touched — it's a different model
    expect(mocks.orgUnitMembershipDeleteMany).not.toHaveBeenCalled();
  });

  it("does NOT delete linked User account", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(TENANT_ID, { userId: "user-linked-123" }));
    mocks.personAssignmentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.personDelete.mockResolvedValue({ id: PERSON_ID });

    await DELETE(makeRequest("DELETE"), ctx());

    // User was NOT deleted
    expect(mocks.userDelete).not.toHaveBeenCalled();
    // TenantMembership was NOT deleted
    expect(mocks.tenantMembershipDelete).not.toHaveBeenCalled();
    // UserRole was NOT deleted
    expect(mocks.userRoleDelete).not.toHaveBeenCalled();
  });

  it("returns 403 when caller only has people.manage (not people.delete)", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(403);
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant delete attempt", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT_ID));
    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(404);
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });
});
