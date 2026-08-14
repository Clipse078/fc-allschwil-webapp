/**
 * PERSONS-02-C1 — /api/people/[id]/assignments route tests (hardened).
 *
 * Covers:
 * - POST creates OrgUnit-only assignment (teamId = null)
 * - POST creates team assignment (with teamId)
 * - POST rejects unknown function key
 * - POST rejects exact duplicate (same person+orgUnit+team+function+season+ACTIVE → 409)
 * - POST rejects cross-tenant OrgUnit (tenantId mismatch → 404)
 * - POST rejects cross-tenant Team (tenantId mismatch → 404)
 * - POST does NOT create OrgUnitMembership (dedicated model only)
 * - POST does NOT create UserRole
 * - POST does NOT create TenantMembership
 * - DELETE removes PersonAssignment without touching person
 * - DELETE rejects unauthorized caller
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  orgUnitFindUnique: vi.fn(),
  teamFindUnique: vi.fn(),
  seasonFindUnique: vi.fn(),
  personAssignmentFindFirst: vi.fn(),
  personAssignmentCreate: vi.fn(),
  personAssignmentFindMany: vi.fn(),
  personAssignmentDelete: vi.fn(),
  // Must NOT be called by PersonAssignment operations
  orgUnitMembershipCreate: vi.fn(),
  orgUnitMembershipFindMany: vi.fn(),
  userRoleCreate: vi.fn(),
  tenantMembershipCreate: vi.fn(),
  logAction: vi.fn(),
  getPersonAssignments: vi.fn(),
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
    orgUnit: { findUnique: mocks.orgUnitFindUnique },
    team: { findUnique: mocks.teamFindUnique },
    season: { findUnique: mocks.seasonFindUnique },
    personAssignment: {
      findFirst: mocks.personAssignmentFindFirst,
      create: mocks.personAssignmentCreate,
      findMany: mocks.personAssignmentFindMany,
      delete: mocks.personAssignmentDelete,
    },
    orgUnitMembership: {
      create: mocks.orgUnitMembershipCreate,
      findMany: mocks.orgUnitMembershipFindMany,
    },
    userRole: { create: mocks.userRoleCreate },
    tenantMembership: { create: mocks.tenantMembershipCreate },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));
vi.mock("@/lib/people/queries", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/people/queries")>();
  return { ...original, getPersonAssignments: mocks.getPersonAssignments };
});

import { POST, GET } from "@/app/api/people/[id]/assignments/route";
import { DELETE } from "@/app/api/people/[id]/assignments/[assignmentId]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-123";
const TENANT_ID = "tenant-001";
const OTHER_TENANT = "tenant-other";
const ORG_UNIT_ID = "ou-001";
const TEAM_ID = "team-001";
const ASSIGNMENT_ID = "assign-001";

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
function postCtx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}
function deleteCtx() {
  return { params: Promise.resolve({ id: PERSON_ID, assignmentId: ASSIGNMENT_ID }) };
}
function makeReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/people/${PERSON_ID}/assignments`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiActiveTenantId.mockResolvedValue({ ok: true, tenantId: TENANT_ID });
  mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_ID });
  mocks.orgUnitFindUnique.mockResolvedValue({ id: ORG_UNIT_ID, tenantId: TENANT_ID, name: "Kinderfussball" });
  mocks.teamFindUnique.mockResolvedValue({ id: TEAM_ID, tenantId: TENANT_ID });
  mocks.personAssignmentFindFirst.mockResolvedValue(null); // no duplicate
  mocks.logAction.mockResolvedValue(undefined);
});

// ── POST (create assignment) ──────────────────────────────────────────────────

describe("POST /api/people/[id]/assignments", () => {
  it("creates OrgUnit-only assignment (teamId = null)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      seasonId: null,
      functionKey: "TRAINER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kinderfussball", key: "kf" },
      team: null,
      season: null,
    });

    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assignment.teamId).toBeNull();
    expect(body.assignment.functionKey).toBe("TRAINER");
  });

  it("creates team assignment with teamId", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: TEAM_ID,
      functionKey: "SPIELER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kf", key: "kf" },
      team: { id: TEAM_ID, name: "F2", shortName: "F2" },
      season: null,
    });

    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, teamId: TEAM_ID, functionKey: "SPIELER" }),
      postCtx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assignment.teamId).toBe(TEAM_ID);
  });

  it("does NOT create OrgUnitMembership row (dedicated PersonAssignment model)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      functionKey: "TRAINER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kf", key: "kf" },
      team: null,
      season: null,
    });

    await POST(makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }), postCtx());

    // OrgUnitMembership.create must NEVER be called
    expect(mocks.orgUnitMembershipCreate).not.toHaveBeenCalled();
    // PersonAssignment.create must be called
    expect(mocks.personAssignmentCreate).toHaveBeenCalledOnce();
  });

  it("does NOT create UserRole (function is not an auth role)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      functionKey: "TRAINER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kf", key: "kf" },
      team: null,
      season: null,
    });

    await POST(makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }), postCtx());

    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for missing orgUnitId", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(makeReq("POST", { functionKey: "TRAINER" }), postCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing functionKey", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(makeReq("POST", { orgUnitId: ORG_UNIT_ID }), postCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown function key", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "NOT_A_VALID_FUNCTION" }),
      postCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for exact duplicate ACTIVE assignment", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentFindFirst.mockResolvedValue({ id: "existing-123" });
    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 for cross-tenant OrgUnit", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.orgUnitFindUnique.mockResolvedValue({ id: ORG_UNIT_ID, tenantId: OTHER_TENANT });
    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant Team", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.teamFindUnique.mockResolvedValue({ id: TEAM_ID, tenantId: OTHER_TENANT });
    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, teamId: TEAM_ID, functionKey: "SPIELER" }),
      postCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when unauthorized", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await POST(makeReq("POST", {}), postCtx());
    expect(res.status).toBe(403);
    expect(mocks.personAssignmentCreate).not.toHaveBeenCalled();
  });
});

// ── DELETE (remove assignment) ────────────────────────────────────────────────

describe("DELETE /api/people/[id]/assignments/[assignmentId]", () => {
  it("removes PersonAssignment without touching person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personAssignmentFindFirst.mockResolvedValue({
      id: ASSIGNMENT_ID,
      personId: PERSON_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      functionKey: "TRAINER",
      tenantId: TENANT_ID,
      status: "ACTIVE",
    });
    mocks.personAssignmentDelete.mockResolvedValue({ id: ASSIGNMENT_ID });

    const res = await DELETE(
      new NextRequest(`http://localhost/api/people/${PERSON_ID}/assignments/${ASSIGNMENT_ID}`, {
        method: "DELETE",
      }),
      deleteCtx(),
    );
    expect(res.status).toBe(200);
    expect(mocks.personAssignmentDelete).toHaveBeenCalledOnce();
  });

  it("returns 403 when unauthorized", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await DELETE(
      new NextRequest(`http://localhost/api/people/${PERSON_ID}/assignments/${ASSIGNMENT_ID}`, {
        method: "DELETE",
      }),
      deleteCtx(),
    );
    expect(res.status).toBe(403);
    expect(mocks.personAssignmentDelete).not.toHaveBeenCalled();
  });
});
