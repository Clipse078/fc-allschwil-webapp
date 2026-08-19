/**
 * PERSON-UX-10 — /api/people/[id]/guardians route tests.
 *
 * Tests:
 *  1. GET returns 403 without PEOPLE_CONTACT_VIEW or MANAGE
 *  2. GET returns 404 for unknown/cross-tenant person
 *  3. GET returns relationships list
 *  4. POST returns 403 without PEOPLE_CONTACT_MANAGE
 *  5. POST returns 404 for cross-tenant child person
 *  6. POST creates guardian relationship and audits
 *  7. POST blocks self-link (childPersonId == guardianPersonId)
 *  8. POST blocks cross-tenant guardian person
 *  9. POST blocks duplicate relationship (409)
 * 10. DELETE removes only the relationship record
 * 11. DELETE returns 404 for cross-tenant relationship
 * 12. PATCH updates relationship metadata
 *
 * INVARIANT: GuardianRelationship operations NEVER:
 *  - create User / TenantMembership / Role / RolePermission
 *  - imply mobile/web access
 *  Relationship and authorization are separate domains.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  guardianRelationshipFindMany: vi.fn(),
  guardianRelationshipFindUnique: vi.fn(),
  guardianRelationshipCreate: vi.fn(),
  guardianRelationshipUpdate: vi.fn(),
  guardianRelationshipDelete: vi.fn(),
  // INVARIANT: these must NEVER be called by guardian operations
  userCreate: vi.fn(),
  tenantMembershipCreate: vi.fn(),
  roleCreate: vi.fn(),
  rolePermissionCreate: vi.fn(),
  userRoleCreate: vi.fn(),
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
    person: { findUnique: mocks.personFindUnique },
    guardianRelationship: {
      findMany: mocks.guardianRelationshipFindMany,
      findUnique: mocks.guardianRelationshipFindUnique,
      create: mocks.guardianRelationshipCreate,
      update: mocks.guardianRelationshipUpdate,
      delete: mocks.guardianRelationshipDelete,
    },
    user: { create: mocks.userCreate },
    tenantMembership: { create: mocks.tenantMembershipCreate },
    role: { create: mocks.roleCreate },
    rolePermission: { create: mocks.rolePermissionCreate },
    userRole: { create: mocks.userRoleCreate },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { GET, POST } from "@/app/api/people/[id]/guardians/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/people/[id]/guardians/[relationshipId]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-child-001";
const GUARDIAN_PERSON_ID = "person-guardian-001";
const TENANT_ID = "tenant-001";
const OTHER_TENANT = "tenant-other";
const RELATIONSHIP_ID = "rel-001";

function authorized() {
  return {
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: "actor-1" } },
  };
}
function unauthorized() {
  return { ok: false, status: 403, error: "Forbidden" };
}
function listCtx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}
function relCtx() {
  return {
    params: Promise.resolve({
      id: PERSON_ID,
      relationshipId: RELATIONSHIP_ID,
    }),
  };
}
function makeRequest(method = "GET", body?: unknown) {
  return new NextRequest(
    `http://localhost/api/people/${PERSON_ID}/guardians`,
    {
      method,
      ...(body
        ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
        : {}),
    },
  );
}
function makePerson(tenantId = TENANT_ID) {
  return { id: PERSON_ID, tenantId };
}
function makeGuardianPerson(id = GUARDIAN_PERSON_ID, tenantId = TENANT_ID) {
  return { id, tenantId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiActiveTenantId.mockResolvedValue({
    ok: true,
    tenantId: TENANT_ID,
  });
  mocks.logAction.mockResolvedValue(undefined);
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/people/[id]/guardians", () => {
  it("returns 403 without contact view permission", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(unauthorized());
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown person", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant person (no leakage)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT));
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(404);
  });

  it("returns relationships list for authorized caller", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.guardianRelationshipFindMany.mockResolvedValue([
      {
        id: RELATIONSHIP_ID,
        relationshipType: "MOTHER",
        isPrimary: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        guardianPerson: {
          id: GUARDIAN_PERSON_ID,
          firstName: "Anna",
          lastName: "Muster",
          displayName: null,
          email: "anna@example.com",
          phone: null,
          imageUrl: null,
          isActive: true,
        },
      },
    ]);
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.relationships).toHaveLength(1);
    expect(data.relationships[0].relationshipType).toBe("MOTHER");
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/people/[id]/guardians", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await POST(makeRequest("POST", { guardianPersonId: GUARDIAN_PERSON_ID }), listCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when guardianPersonId is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await POST(makeRequest("POST", {}), listCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-tenant child person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT));
    const res = await POST(
      makeRequest("POST", { guardianPersonId: GUARDIAN_PERSON_ID }),
      listCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when child and guardian are the same person (self-link)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await POST(
      makeRequest("POST", { guardianPersonId: PERSON_ID }),
      listCtx(),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/eigener Erziehungsberechtigter/);
  });

  it("returns 404 when guardian person is cross-tenant", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    // child resolves ok
    mocks.personFindUnique
      .mockResolvedValueOnce(makePerson())
      // guardian returns cross-tenant → null from service
      .mockResolvedValueOnce(makeGuardianPerson(GUARDIAN_PERSON_ID, OTHER_TENANT));
    mocks.guardianRelationshipFindUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest("POST", { guardianPersonId: GUARDIAN_PERSON_ID }),
      listCtx(),
    );
    expect(res.status).toBe(404);
    // INVARIANT: no User, TenantMembership, Role created
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate relationship", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique
      .mockResolvedValueOnce(makePerson())
      .mockResolvedValueOnce(makeGuardianPerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue({
      id: RELATIONSHIP_ID,
    });
    const res = await POST(
      makeRequest("POST", { guardianPersonId: GUARDIAN_PERSON_ID }),
      listCtx(),
    );
    expect(res.status).toBe(409);
  });

  it("creates relationship, audits, and returns 201 — no auth side effects", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique
      .mockResolvedValueOnce(makePerson())
      .mockResolvedValueOnce(makeGuardianPerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue(null);
    mocks.guardianRelationshipCreate.mockResolvedValue({
      id: RELATIONSHIP_ID,
    });

    const res = await POST(
      makeRequest("POST", {
        guardianPersonId: GUARDIAN_PERSON_ID,
        relationshipType: "MOTHER",
        isPrimary: true,
      }),
      listCtx(),
    );
    expect(res.status).toBe(201);

    // Audit called with GUARDIAN_RELATIONSHIP_CREATED
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "GUARDIAN_RELATIONSHIP_CREATED" }),
    );

    // INVARIANT: relationship creation must not create auth entities
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.roleCreate).not.toHaveBeenCalled();
    expect(mocks.rolePermissionCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/people/[id]/guardians/[relationshipId]", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await PATCH(
      makeRequest("PATCH", { isPrimary: false }),
      relCtx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant relationship", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue({
      id: RELATIONSHIP_ID,
      childPersonId: PERSON_ID,
      tenantId: OTHER_TENANT,
    });
    const res = await PATCH(
      makeRequest("PATCH", { isPrimary: false }),
      relCtx(),
    );
    expect(res.status).toBe(404);
    expect(mocks.guardianRelationshipUpdate).not.toHaveBeenCalled();
  });

  it("updates metadata and audits", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue({
      id: RELATIONSHIP_ID,
      childPersonId: PERSON_ID,
      tenantId: TENANT_ID,
    });
    mocks.guardianRelationshipUpdate.mockResolvedValue({ id: RELATIONSHIP_ID });

    const res = await PATCH(
      makeRequest("PATCH", { isPrimary: true, relationshipType: "FATHER" }),
      relCtx(),
    );
    expect(res.status).toBe(200);
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "GUARDIAN_RELATIONSHIP_UPDATED" }),
    );
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/people/[id]/guardians/[relationshipId]", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await DELETE(makeRequest("DELETE"), relCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant relationship", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue({
      id: RELATIONSHIP_ID,
      childPersonId: PERSON_ID,
      tenantId: OTHER_TENANT,
    });
    const res = await DELETE(makeRequest("DELETE"), relCtx());
    expect(res.status).toBe(404);
    expect(mocks.guardianRelationshipDelete).not.toHaveBeenCalled();
  });

  it("deletes only the relationship, audits REMOVED — no Person deleted", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.guardianRelationshipFindUnique.mockResolvedValue({
      id: RELATIONSHIP_ID,
      childPersonId: PERSON_ID,
      tenantId: TENANT_ID,
    });
    mocks.guardianRelationshipDelete.mockResolvedValue({ id: RELATIONSHIP_ID });

    const res = await DELETE(makeRequest("DELETE"), relCtx());
    expect(res.status).toBe(204);

    // Relationship was deleted
    expect(mocks.guardianRelationshipDelete).toHaveBeenCalledWith({
      where: { id: RELATIONSHIP_ID },
    });

    // Audit says REMOVED with personSideEffect: none
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "GUARDIAN_RELATIONSHIP_REMOVED",
        afterJson: expect.objectContaining({ personSideEffect: "none" }),
      }),
    );

    // INVARIANT: no auth entities touched
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });
});
