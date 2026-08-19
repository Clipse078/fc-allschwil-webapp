/**
 * PERSON-UX-10 — /api/people/[id]/emergency-contacts route tests.
 *
 * Tests:
 *  1. GET returns 403 without PEOPLE_CONTACT_VIEW or MANAGE
 *  2. GET returns 404 for unknown/cross-tenant person
 *  3. GET returns contacts list
 *  4. POST returns 403 without PEOPLE_CONTACT_MANAGE
 *  5. POST validates required fields (firstName, lastName, phone)
 *  6. POST returns 404 for cross-tenant person
 *  7. POST creates contact and audits
 *  8. PATCH updates contact metadata
 *  9. PATCH returns 404 for cross-tenant contact
 * 10. DELETE removes only the contact record
 * 11. DELETE returns 404 for cross-tenant contact
 *
 * INVARIANT: PersonEmergencyContact operations NEVER:
 *  - delete or modify the associated Person
 *  - create User / TenantMembership / Role / RolePermission
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  emergencyContactFindMany: vi.fn(),
  emergencyContactFindUnique: vi.fn(),
  emergencyContactCreate: vi.fn(),
  emergencyContactUpdate: vi.fn(),
  emergencyContactDelete: vi.fn(),
  personUpdate: vi.fn(),
  personDelete: vi.fn(),
  // INVARIANT: must NOT be called
  userCreate: vi.fn(),
  tenantMembershipCreate: vi.fn(),
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
    person: {
      findUnique: mocks.personFindUnique,
      update: mocks.personUpdate,
      delete: mocks.personDelete,
    },
    personEmergencyContact: {
      findMany: mocks.emergencyContactFindMany,
      findUnique: mocks.emergencyContactFindUnique,
      create: mocks.emergencyContactCreate,
      update: mocks.emergencyContactUpdate,
      delete: mocks.emergencyContactDelete,
    },
    user: { create: mocks.userCreate },
    tenantMembership: { create: mocks.tenantMembershipCreate },
    userRole: { create: mocks.userRoleCreate },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { GET, POST } from "@/app/api/people/[id]/emergency-contacts/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/people/[id]/emergency-contacts/[contactId]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-001";
const CONTACT_ID = "contact-001";
const TENANT_ID = "tenant-001";
const OTHER_TENANT = "tenant-other";

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
function contactCtx() {
  return { params: Promise.resolve({ id: PERSON_ID, contactId: CONTACT_ID }) };
}
function makeRequest(method = "GET", body?: unknown) {
  return new NextRequest(
    `http://localhost/api/people/${PERSON_ID}/emergency-contacts`,
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
function makeContact(overrides = {}) {
  return {
    id: CONTACT_ID,
    personId: PERSON_ID,
    tenantId: TENANT_ID,
    firstName: "Hans",
    lastName: "Muster",
    relationship: "Vater",
    phone: "+41 79 000 00 00",
    email: null,
    priority: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
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

describe("GET /api/people/[id]/emergency-contacts", () => {
  it("returns 403 without contact view permission", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(unauthorized());
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant person (no leakage)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT));
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(404);
  });

  it("returns contacts sorted by priority for authorized caller", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindMany.mockResolvedValue([
      makeContact({ priority: 0 }),
      makeContact({ id: "contact-002", priority: 1 }),
    ]);
    const res = await GET(makeRequest(), listCtx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contacts).toHaveLength(2);
    expect(data.contacts[0].priority).toBe(0);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/people/[id]/emergency-contacts", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await POST(
      makeRequest("POST", { firstName: "Hans", lastName: "M", phone: "123" }),
      listCtx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when firstName is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await POST(
      makeRequest("POST", { lastName: "Muster", phone: "123" }),
      listCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when lastName is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await POST(
      makeRequest("POST", { firstName: "Hans", phone: "123" }),
      listCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    const res = await POST(
      makeRequest("POST", { firstName: "Hans", lastName: "Muster" }),
      listCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-tenant person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson(OTHER_TENANT));
    const res = await POST(
      makeRequest("POST", { firstName: "Hans", lastName: "M", phone: "123" }),
      listCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("creates contact, audits, and returns 201 — no auth side effects", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactCreate.mockResolvedValue({ id: CONTACT_ID });

    const res = await POST(
      makeRequest("POST", {
        firstName: "Hans",
        lastName: "Muster",
        phone: "+41 79 000 00 00",
        relationship: "Vater",
        priority: 0,
      }),
      listCtx(),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.contact.id).toBe(CONTACT_ID);

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "EMERGENCY_CONTACT_CREATED" }),
    );

    // INVARIANT: no auth entities created
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("creates multiple contacts for same person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactCreate
      .mockResolvedValueOnce({ id: "contact-001" })
      .mockResolvedValueOnce({ id: "contact-002" });

    const res1 = await POST(
      makeRequest("POST", { firstName: "A", lastName: "B", phone: "111", priority: 0 }),
      listCtx(),
    );
    const res2 = await POST(
      makeRequest("POST", { firstName: "C", lastName: "D", phone: "222", priority: 1 }),
      listCtx(),
    );
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/people/[id]/emergency-contacts/[contactId]", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await PATCH(
      makeRequest("PATCH", { phone: "999" }),
      contactCtx(),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant contact", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindUnique.mockResolvedValue(
      makeContact({ tenantId: OTHER_TENANT }),
    );
    const res = await PATCH(
      makeRequest("PATCH", { phone: "999" }),
      contactCtx(),
    );
    expect(res.status).toBe(404);
    expect(mocks.emergencyContactUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when phone is updated to empty string", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindUnique.mockResolvedValue(makeContact());
    const res = await PATCH(
      makeRequest("PATCH", { phone: "" }),
      contactCtx(),
    );
    expect(res.status).toBe(400);
    expect(mocks.emergencyContactUpdate).not.toHaveBeenCalled();
  });

  it("updates contact and audits UPDATED", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindUnique.mockResolvedValue(makeContact());
    mocks.emergencyContactUpdate.mockResolvedValue({ id: CONTACT_ID });

    const res = await PATCH(
      makeRequest("PATCH", { phone: "+41 79 999 99 99", priority: 1 }),
      contactCtx(),
    );
    expect(res.status).toBe(200);
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "EMERGENCY_CONTACT_UPDATED" }),
    );
    // Person record not touched
    expect(mocks.personUpdate).not.toHaveBeenCalled();
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/people/[id]/emergency-contacts/[contactId]", () => {
  it("returns 403 without PEOPLE_CONTACT_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await DELETE(makeRequest("DELETE"), contactCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 for cross-tenant contact", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindUnique.mockResolvedValue(
      makeContact({ tenantId: OTHER_TENANT }),
    );
    const res = await DELETE(makeRequest("DELETE"), contactCtx());
    expect(res.status).toBe(404);
    expect(mocks.emergencyContactDelete).not.toHaveBeenCalled();
  });

  it("deletes contact, audits DELETED — Person record not modified", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.emergencyContactFindUnique.mockResolvedValue(makeContact());
    mocks.emergencyContactDelete.mockResolvedValue({ id: CONTACT_ID });

    const res = await DELETE(makeRequest("DELETE"), contactCtx());
    expect(res.status).toBe(204);

    // Contact deleted
    expect(mocks.emergencyContactDelete).toHaveBeenCalledWith({
      where: { id: CONTACT_ID },
    });

    // Person not deleted
    expect(mocks.personDelete).not.toHaveBeenCalled();
    expect(mocks.personUpdate).not.toHaveBeenCalled();

    // Audit says DELETED with personSideEffect: none
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EMERGENCY_CONTACT_DELETED",
        afterJson: expect.objectContaining({ personSideEffect: "none" }),
      }),
    );

    // INVARIANT
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });
});
