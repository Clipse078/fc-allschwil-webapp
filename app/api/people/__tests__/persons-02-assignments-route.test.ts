/**
 * PERSONS-02 — /api/people/[id]/assignments route tests.
 *
 * Covers:
 * - POST creates OrgUnit-only assignment (no team)
 * - POST creates team assignment (with teamId)
 * - POST rejects unknown function key
 * - POST rejects exact duplicate assignment (same person+orgUnit+team+function+season)
 * - POST rejects cross-tenant OrgUnit
 * - POST rejects cross-tenant Team
 * - DELETE removes assignment (not person)
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
  orgUnitMembershipFindFirst: vi.fn(),
  orgUnitMembershipCreate: vi.fn(),
  orgUnitMembershipFindMany: vi.fn(),
  orgUnitMembershipDelete: vi.fn(),
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
    orgUnitMembership: {
      findFirst: mocks.orgUnitMembershipFindFirst,
      create: mocks.orgUnitMembershipCreate,
      findMany: mocks.orgUnitMembershipFindMany,
      delete: mocks.orgUnitMembershipDelete,
    },
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

function makeReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/people/${PERSON_ID}/assignments`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function postCtx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}

function deleteCtx() {
  return { params: Promise.resolve({ id: PERSON_ID, assignmentId: ASSIGNMENT_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiActiveTenantId.mockResolvedValue({ ok: true, tenantId: TENANT_ID });
  mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_ID });
  mocks.orgUnitFindUnique.mockResolvedValue({ id: ORG_UNIT_ID, tenantId: TENANT_ID, name: "Kinderfussball" });
  mocks.teamFindUnique.mockResolvedValue({ id: TEAM_ID, tenantId: TENANT_ID });
  mocks.orgUnitMembershipFindFirst.mockResolvedValue(null); // no duplicate
  mocks.logAction.mockResolvedValue(undefined);
});

// ── POST (create assignment) ──────────────────────────────────────────────────

describe("POST /api/people/[id]/assignments", () => {
  it("creates OrgUnit-only assignment (no team)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.orgUnitMembershipCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      seasonId: null,
      roleKey: "TRAINER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kinderfussball", key: "kinderfussball" },
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
    expect(body.assignment.roleKey).toBe("TRAINER");
  });

  it("creates team assignment with teamId", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.orgUnitMembershipCreate.mockResolvedValue({
      id: ASSIGNMENT_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: TEAM_ID,
      seasonId: null,
      roleKey: "SPIELER",
      status: "ACTIVE",
      orgUnit: { id: ORG_UNIT_ID, name: "Kinderfussball", key: "kf" },
      team: { id: TEAM_ID, name: "F2", shortName: "F2" },
      season: null,
    });

    const res = await POST(
      makeReq("POST", {
        orgUnitId: ORG_UNIT_ID,
        teamId: TEAM_ID,
        functionKey: "SPIELER",
      }),
      postCtx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assignment.teamId).toBe(TEAM_ID);
  });

  it("returns 400 for missing orgUnitId", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(
      makeReq("POST", { functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing functionKey", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID }),
      postCtx(),
    );
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

  it("returns 409 for exact duplicate active assignment", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    // Duplicate already exists
    mocks.orgUnitMembershipFindFirst.mockResolvedValue({ id: "existing-assign" });

    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(409);
  });

  it("returns 404 for cross-tenant OrgUnit", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.orgUnitFindUnique.mockResolvedValue({
      id: ORG_UNIT_ID,
      tenantId: "other-tenant",
      name: "Other OrgUnit",
    });

    const res = await POST(
      makeReq("POST", { orgUnitId: ORG_UNIT_ID, functionKey: "TRAINER" }),
      postCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant Team", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.teamFindUnique.mockResolvedValue({ id: TEAM_ID, tenantId: "other-tenant" });

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
  });
});

// ── DELETE (remove assignment) ────────────────────────────────────────────────

describe("DELETE /api/people/[id]/assignments/[assignmentId]", () => {
  it("removes assignment without deleting person", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.orgUnitMembershipFindFirst.mockResolvedValue({
      id: ASSIGNMENT_ID,
      personId: PERSON_ID,
      orgUnitId: ORG_UNIT_ID,
      teamId: null,
      roleKey: "TRAINER",
      tenantId: TENANT_ID,
    });
    mocks.orgUnitMembershipDelete.mockResolvedValue({ id: ASSIGNMENT_ID });

    const res = await DELETE(
      new NextRequest(`http://localhost/api/people/${PERSON_ID}/assignments/${ASSIGNMENT_ID}`, {
        method: "DELETE",
      }),
      deleteCtx(),
    );
    expect(res.status).toBe(200);
    expect(mocks.orgUnitMembershipDelete).toHaveBeenCalledOnce();
    // Person was NOT deleted
    // (No person.delete in mocks would throw if called)
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
  });
});
