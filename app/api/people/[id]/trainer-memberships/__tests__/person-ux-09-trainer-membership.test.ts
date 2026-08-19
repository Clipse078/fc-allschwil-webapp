/**
 * PERSON-UX-09 — /api/people/[id]/trainer-memberships/[trainerMemberId] DELETE tests.
 *
 * Covers:
 *  1. Requires people.manage permission
 *  2. Person not in tenant → 404 (tenant isolation)
 *  3. TrainerMember not belonging to person → 404
 *  4. Cross-tenant target rejected
 *  5. Successful removal returns 200
 *  6. Person record is never deleted
 *  7. logAction called with correct metadata
 *  8. Unauthorized removal rejected
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindFirst: vi.fn(),
  trainerTeamMemberFindFirst: vi.fn(),
  trainerTeamMemberDelete: vi.fn(),
  personDelete: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  requireApiActiveTenantId: mocks.requireApiActiveTenantId,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      delete: mocks.personDelete,
    },
    trainerTeamMember: {
      findFirst: mocks.trainerTeamMemberFindFirst,
      delete: mocks.trainerTeamMemberDelete,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import { DELETE } from "@/app/api/people/[id]/trainer-memberships/[trainerMemberId]/route";
import { NextRequest } from "next/server";

function makeContext(personId: string, trainerMemberId: string) {
  return { params: Promise.resolve({ id: personId, trainerMemberId }) };
}

function makeAuthorizedAccess() {
  return {
    ok: true, status: 200, error: null,
    session: { user: { id: "user-admin", effectiveUserId: null, email: "a@t.com", activeTenantId: "t1" }, expires: "2099" },
  };
}

const PERSON = {
  id: "person-09",
  firstName: "Klaus",
  lastName: "Bauer",
  displayName: null,
};

const TRAINER_MEMBER = {
  id: "tm-1",
  personId: "person-09",
  teamSeasonId: "ts-1",
  status: "ACTIVE",
  roleLabel: "Cheftrainer",
  isWebsiteVisible: false,
  sortOrder: 0,
  remarks: null,
  teamSeason: {
    id: "ts-1",
    team: { id: "t-s40", name: "Senioren 40+" },
    season: { id: "s-1", name: "2026/27", key: "2026-27" },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DELETE /api/people/[id]/trainer-memberships/[trainerMemberId]", () => {
  it("returns 403 when not authorized", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden." });
    const req = new NextRequest("http://localhost/api/people/p/trainer-memberships/tm", { method: "DELETE" });
    const res = await DELETE(req, makeContext("p", "tm"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when person not in tenant (tenant isolation)", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/people/other/trainer-memberships/tm", { method: "DELETE" });
    const res = await DELETE(req, makeContext("other", "tm"));
    expect(res.status).toBe(404);
    expect(mocks.trainerTeamMemberDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when trainer member does not belong to person", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.trainerTeamMemberFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/people/person-09/trainer-memberships/tm-other", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09", "tm-other"));
    expect(res.status).toBe(404);
    expect(mocks.trainerTeamMemberDelete).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes trainer member on success", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.trainerTeamMemberFindFirst.mockResolvedValueOnce(TRAINER_MEMBER);
    mocks.trainerTeamMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/trainer-memberships/tm-1", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09", "tm-1"));
    expect(res.status).toBe(200);
    expect(mocks.trainerTeamMemberDelete).toHaveBeenCalledWith({ where: { id: "tm-1" } });
  });

  it("never deletes Person record", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.trainerTeamMemberFindFirst.mockResolvedValueOnce(TRAINER_MEMBER);
    mocks.trainerTeamMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/trainer-memberships/tm-1", { method: "DELETE" });
    await DELETE(req, makeContext("person-09", "tm-1"));
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });

  it("logs removal action with person and team metadata", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.trainerTeamMemberFindFirst.mockResolvedValueOnce(TRAINER_MEMBER);
    mocks.trainerTeamMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/trainer-memberships/tm-1", { method: "DELETE" });
    await DELETE(req, makeContext("person-09", "tm-1"));

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "TrainerTeamMember",
        entityId: "tm-1",
        action: "trainer_membership_removed_from_person_workspace",
        metadataJson: expect.objectContaining({ personId: "person-09" }),
      }),
    );
  });
});
