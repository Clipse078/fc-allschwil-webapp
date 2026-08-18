/**
 * PERSON-UX-04 — /api/people/[id]/memberships route tests.
 *
 * API-layer tests covering:
 *  9.  create requires manage authority
 * 10.  update requires manage authority
 * 11.  end requires manage authority
 * 12.  invalid endsAt < startsAt rejected
 * 13.  cross-tenant Person rejected
 * 14.  cross-tenant membership rejected
 * 15.  ending membership does not deactivate Person
 * 16.  ending membership does not touch sporting assignments
 * 17.  membership mutation produces audit call
 *
 * INVARIANTS tested:
 *   - PersonMembership is NOT TenantMembership / OrgUnitMembership / PersonAssignment
 *   - no auth side-effects on create/update/end
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindUnique: vi.fn(),
  personMembershipCreate: vi.fn(),
  personMembershipFindFirst: vi.fn(),
  personMembershipFindMany: vi.fn(),
  personMembershipUpdate: vi.fn(),
  personUpdate: vi.fn(),
  // Must NOT be called by PersonMembership operations
  tenantMembershipCreate: vi.fn(),
  userRoleCreate: vi.fn(),
  orgUnitMembershipCreate: vi.fn(),
  personAssignmentCreate: vi.fn(),
  playerSquadMemberCreate: vi.fn(),
  trainerTeamMemberCreate: vi.fn(),
  logAction: vi.fn(),
  getPersonMemberships: vi.fn(),
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
    },
    personMembership: {
      create: mocks.personMembershipCreate,
      findFirst: mocks.personMembershipFindFirst,
      findMany: mocks.personMembershipFindMany,
      update: mocks.personMembershipUpdate,
    },
    tenantMembership: { create: mocks.tenantMembershipCreate },
    userRole: { create: mocks.userRoleCreate },
    orgUnitMembership: { create: mocks.orgUnitMembershipCreate },
    personAssignment: { create: mocks.personAssignmentCreate },
    playerSquadMember: { create: mocks.playerSquadMemberCreate },
    trainerTeamMember: { create: mocks.trainerTeamMemberCreate },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));
vi.mock("@/lib/people/queries", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/people/queries")>();
  return { ...original, getPersonMemberships: mocks.getPersonMemberships };
});

import { GET, POST } from "@/app/api/people/[id]/memberships/route";
import { PATCH } from "@/app/api/people/[id]/memberships/[membershipId]/route";
import { NextRequest } from "next/server";

const PERSON_ID = "person-001";
const TENANT_ID = "tenant-001";
const OTHER_TENANT = "tenant-other";
const MEMBERSHIP_ID = "memb-001";

function authorized() {
  return { ok: true, status: 200, error: null, session: { user: { id: "actor-1" } } };
}
function unauthorized() {
  return { ok: false, status: 403, error: "Forbidden" };
}
function listCtx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}
function membershipCtx() {
  return { params: Promise.resolve({ id: PERSON_ID, membershipId: MEMBERSHIP_ID }) };
}
function makeReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/people/${PERSON_ID}/memberships`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}
function makeMembershipReq(method: string, body?: unknown) {
  return new NextRequest(
    `http://localhost/api/people/${PERSON_ID}/memberships/${MEMBERSHIP_ID}`,
    {
      method,
      ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
    },
  );
}

const SAMPLE_MEMBERSHIP = {
  id: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  personId: PERSON_ID,
  membershipType: "ACTIVE_MEMBER" as const,
  status: "ACTIVE" as const,
  memberNumber: "1234",
  startsAt: new Date("2020-01-01"),
  endsAt: null,
  notes: null,
  createdAt: new Date("2020-01-01"),
  updatedAt: new Date("2020-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiActiveTenantId.mockResolvedValue({ ok: true, tenantId: TENANT_ID });
  mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: TENANT_ID });
  mocks.personMembershipFindFirst.mockResolvedValue(SAMPLE_MEMBERSHIP);
  mocks.logAction.mockResolvedValue(undefined);
});

// ── 9. create requires manage authority ──────────────────────────────────────

describe("9. create requires manage authority", () => {
  it("returns 403 when caller lacks people.manage", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await POST(
      makeReq("POST", { startsAt: "2024-01-01", membershipType: "ACTIVE_MEMBER" }),
      listCtx(),
    );
    expect(res.status).toBe(403);
    expect(mocks.personMembershipCreate).not.toHaveBeenCalled();
  });

  it("creates membership with manage authority", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personMembershipCreate.mockResolvedValue(SAMPLE_MEMBERSHIP);
    const res = await POST(
      makeReq("POST", { startsAt: "2024-01-01", membershipType: "ACTIVE_MEMBER" }),
      listCtx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.membership.id).toBe(MEMBERSHIP_ID);
  });
});

// ── 10. update requires manage authority ─────────────────────────────────────

describe("10. update requires manage authority", () => {
  it("returns 403 when caller lacks people.manage on PATCH", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await PATCH(
      makeMembershipReq("PATCH", { membershipType: "PASSIVE_MEMBER" }),
      membershipCtx(),
    );
    expect(res.status).toBe(403);
    expect(mocks.personMembershipUpdate).not.toHaveBeenCalled();
  });

  it("updates membership with manage authority", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const updated = { ...SAMPLE_MEMBERSHIP, membershipType: "PASSIVE_MEMBER" as const };
    mocks.personMembershipUpdate.mockResolvedValue(updated);
    const res = await PATCH(
      makeMembershipReq("PATCH", { membershipType: "PASSIVE_MEMBER" }),
      membershipCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.membership.membershipType).toBe("PASSIVE_MEMBER");
  });
});

// ── 11. end requires manage authority ────────────────────────────────────────

describe("11. end requires manage authority", () => {
  it("returns 403 when caller lacks people.manage on end action", async () => {
    mocks.requireApiPermission.mockResolvedValue(unauthorized());
    const res = await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2024-12-31" }),
      membershipCtx(),
    );
    expect(res.status).toBe(403);
    expect(mocks.personMembershipUpdate).not.toHaveBeenCalled();
  });

  it("ends membership with manage authority", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const ended = { ...SAMPLE_MEMBERSHIP, status: "ENDED" as const, endsAt: new Date("2024-12-31") };
    mocks.personMembershipUpdate.mockResolvedValue(ended);
    const res = await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2024-12-31" }),
      membershipCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.membership.status).toBe("ENDED");
  });
});

// ── 12. invalid endsAt < startsAt rejected ────────────────────────────────────

describe("12. invalid endsAt < startsAt rejected", () => {
  it("rejects POST where endsAt is before startsAt", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await POST(
      makeReq("POST", { startsAt: "2024-06-01", endsAt: "2024-01-01" }),
      listCtx(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Austrittsdatum");
    expect(mocks.personMembershipCreate).not.toHaveBeenCalled();
  });

  it("rejects PATCH update where endsAt is before existing startsAt", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    // existing membership starts 2020-01-01
    const res = await PATCH(
      makeMembershipReq("PATCH", { endsAt: "2019-01-01" }),
      membershipCtx(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Austrittsdatum");
    expect(mocks.personMembershipUpdate).not.toHaveBeenCalled();
  });

  it("rejects end action where endsAt is before existing startsAt", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const res = await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2019-12-31" }),
      membershipCtx(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Austrittsdatum");
    expect(mocks.personMembershipUpdate).not.toHaveBeenCalled();
  });
});

// ── 13. cross-tenant Person rejected ──────────────────────────────────────────

describe("13. cross-tenant Person rejected", () => {
  it("returns 404 when Person belongs to different tenant (POST)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue({ id: PERSON_ID, tenantId: OTHER_TENANT });
    const res = await POST(
      makeReq("POST", { startsAt: "2024-01-01" }),
      listCtx(),
    );
    expect(res.status).toBe(404);
    expect(mocks.personMembershipCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when Person not found (GET)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.personFindUnique.mockResolvedValue(null);
    const res = await GET(makeReq("GET"), listCtx());
    expect(res.status).toBe(404);
    expect(mocks.personMembershipFindMany).not.toHaveBeenCalled();
  });
});

// ── 14. cross-tenant membership rejected ─────────────────────────────────────

describe("14. cross-tenant membership rejected", () => {
  it("returns 404 when membership belongs to different person+tenant (PATCH)", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personMembershipFindFirst.mockResolvedValue(null); // not found for this person+tenant
    const res = await PATCH(
      makeMembershipReq("PATCH", { membershipType: "PASSIVE_MEMBER" }),
      membershipCtx(),
    );
    expect(res.status).toBe(404);
    expect(mocks.personMembershipUpdate).not.toHaveBeenCalled();
  });
});

// ── 15. ending membership does not deactivate Person ─────────────────────────

describe("15. ending membership does not deactivate Person", () => {
  it("does NOT call person.update when ending a membership", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const ended = { ...SAMPLE_MEMBERSHIP, status: "ENDED" as const, endsAt: new Date("2024-12-31") };
    mocks.personMembershipUpdate.mockResolvedValue(ended);
    await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2024-12-31" }),
      membershipCtx(),
    );
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });
});

// ── 16. ending membership does not touch sporting assignments ─────────────────

describe("16. ending membership does not touch sporting assignments", () => {
  it("does NOT create PlayerSquadMember, TrainerTeamMember, or PersonAssignment", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const ended = { ...SAMPLE_MEMBERSHIP, status: "ENDED" as const, endsAt: new Date("2024-12-31") };
    mocks.personMembershipUpdate.mockResolvedValue(ended);
    await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2024-12-31" }),
      membershipCtx(),
    );
    expect(mocks.playerSquadMemberCreate).not.toHaveBeenCalled();
    expect(mocks.trainerTeamMemberCreate).not.toHaveBeenCalled();
    expect(mocks.personAssignmentCreate).not.toHaveBeenCalled();
  });

  it("does NOT create TenantMembership or UserRole when creating membership", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personMembershipCreate.mockResolvedValue(SAMPLE_MEMBERSHIP);
    await POST(
      makeReq("POST", { startsAt: "2024-01-01", membershipType: "ACTIVE_MEMBER" }),
      listCtx(),
    );
    expect(mocks.tenantMembershipCreate).not.toHaveBeenCalled();
    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
    expect(mocks.orgUnitMembershipCreate).not.toHaveBeenCalled();
  });
});

// ── 17. membership mutation produces audit call ───────────────────────────────

describe("17. membership mutation produces audit call", () => {
  it("POST create logs membership_created audit action", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    mocks.personMembershipCreate.mockResolvedValue(SAMPLE_MEMBERSHIP);
    await POST(
      makeReq("POST", { startsAt: "2024-01-01", membershipType: "ACTIVE_MEMBER" }),
      listCtx(),
    );
    expect(mocks.logAction).toHaveBeenCalledOnce();
    const call = mocks.logAction.mock.calls[0][0];
    expect(call.moduleKey).toBe("persons");
    expect(call.entityType).toBe("PersonMembership");
    expect(call.action).toBe("membership_created");
    expect(call.afterJson).toMatchObject({ authSideEffect: "none" });
  });

  it("PATCH end logs membership_ended audit action", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const ended = { ...SAMPLE_MEMBERSHIP, status: "ENDED" as const, endsAt: new Date("2024-12-31") };
    mocks.personMembershipUpdate.mockResolvedValue(ended);
    await PATCH(
      makeMembershipReq("PATCH", { action: "end", endsAt: "2024-12-31" }),
      membershipCtx(),
    );
    expect(mocks.logAction).toHaveBeenCalledOnce();
    const call = mocks.logAction.mock.calls[0][0];
    expect(call.action).toBe("membership_ended");
    expect(call.afterJson).toMatchObject({ authSideEffect: "none" });
  });

  it("PATCH update logs membership_updated audit action", async () => {
    mocks.requireApiPermission.mockResolvedValue(authorized());
    const updated = { ...SAMPLE_MEMBERSHIP, membershipType: "PASSIVE_MEMBER" as const };
    mocks.personMembershipUpdate.mockResolvedValue(updated);
    await PATCH(
      makeMembershipReq("PATCH", { membershipType: "PASSIVE_MEMBER" }),
      membershipCtx(),
    );
    expect(mocks.logAction).toHaveBeenCalledOnce();
    const call = mocks.logAction.mock.calls[0][0];
    expect(call.action).toBe("membership_updated");
    expect(call.beforeJson).toMatchObject({ membershipType: "ACTIVE_MEMBER" });
    expect(call.afterJson).toMatchObject({ membershipType: "PASSIVE_MEMBER" });
  });
});

// ── GET list ──────────────────────────────────────────────────────────────────

describe("GET /api/people/[id]/memberships", () => {
  it("returns memberships list for authorized viewer", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(authorized());
    mocks.getPersonMemberships.mockResolvedValue([SAMPLE_MEMBERSHIP]);
    const res = await GET(makeReq("GET"), listCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0].id).toBe(MEMBERSHIP_ID);
  });

  it("returns 403 when viewer has no people permission", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(unauthorized());
    const res = await GET(makeReq("GET"), listCtx());
    expect(res.status).toBe(403);
  });
});
