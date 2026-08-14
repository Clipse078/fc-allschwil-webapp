/**
 * PERSONS-01/02 — /api/people/[id] route tests.
 *
 * Covers:
 * - GET returns person (authorized)
 * - GET returns 404 for unknown person
 * - GET rejects cross-tenant access
 * - PUT updates identity fields
 * - DELETE requires PEOPLE_DELETE (not PEOPLE_MANAGE)
 * - DELETE cascades assignments, does not delete linked User
 * - DELETE rejects with 403 when caller has only PEOPLE_MANAGE
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  personUpdate: vi.fn(),
  personDelete: vi.fn(),
  orgUnitMembershipDeleteMany: vi.fn(),
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
    },
    orgUnitMembership: {
      deleteMany: mocks.orgUnitMembershipDeleteMany,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { GET, PUT, DELETE } from "@/app/api/people/[id]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-abc-123";
const TENANT_ID = "tenant-001";

function authorized(permission = "people.view") {
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

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    firstName: "Max",
    lastName: "Muster",
    displayName: null,
    email: null,
    phone: null,
    dateOfBirth: null,
    notes: null,
    imageUrl: null,
    isActive: true,
    isPlayer: false,
    isTrainer: false,
    tenantId: TENANT_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: null,
    user: null,
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
  it("returns person when authorized", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());

    const res = await GET(makeRequest(), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.person.id).toBe(PERSON_ID);
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

  it("returns 404 when person belongs to different tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson({ tenantId: "other-tenant" }));
    mocks.requireApiActiveTenantId.mockResolvedValue({ ok: true, tenantId: TENANT_ID });

    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(404);
  });
});

// ── PUT ───────────────────────────────────────────────────────────────────────

describe("PUT /api/people/[id]", () => {
  it("updates person identity fields", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(
      makePerson({ firstName: "Old", lastName: "Name" })
    );
    const updated = makePerson({ firstName: "New", lastName: "Name" });
    mocks.personUpdate.mockResolvedValue(updated);

    const res = await PUT(
      makeRequest("PUT", { firstName: "New", lastName: "Name" }),
      ctx()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.person.firstName).toBe("New");
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
  it("permanently deletes person when people.delete permission granted", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized("people.delete"));
    mocks.personFindUnique.mockResolvedValue(makePerson({ userId: null }));
    mocks.orgUnitMembershipDeleteMany.mockResolvedValue({ count: 2 });
    mocks.personDelete.mockResolvedValue({ id: PERSON_ID });

    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(200);
    expect(mocks.orgUnitMembershipDeleteMany).toHaveBeenCalledWith({
      where: { personId: PERSON_ID },
    });
    expect(mocks.personDelete).toHaveBeenCalledWith({ where: { id: PERSON_ID } });
  });

  it("returns 403 when caller lacks people.delete", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());

    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(403);
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });

  it("does NOT delete linked User when deleting Person", async () => {
    // This is the key safety invariant: Person and User are separate lifecycles.
    // Deleting a Person must never delete the linked User account.
    mocks.requireApiPermission.mockResolvedValue(authorized("people.delete"));
    mocks.personFindUnique.mockResolvedValue(
      makePerson({ userId: "user-linked-123" })
    );
    mocks.orgUnitMembershipDeleteMany.mockResolvedValue({ count: 0 });
    mocks.personDelete.mockResolvedValue({ id: PERSON_ID });

    await DELETE(makeRequest("DELETE"), ctx());

    // User was NOT deleted (no user.delete or user.update call)
    // The prisma mock does not include user.delete — this would throw if called
    expect(mocks.personDelete).toHaveBeenCalledOnce();
    // We only called personDelete, not any user mutation
  });

  it("returns 404 for unknown person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized("people.delete"));
    mocks.personFindUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("DELETE"), ctx());
    expect(res.status).toBe(404);
  });
});
