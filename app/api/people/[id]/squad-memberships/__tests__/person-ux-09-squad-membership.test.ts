/**
 * PERSON-UX-09 — /api/people/[id]/squad-memberships/[squadMemberId] DELETE tests.
 *
 * Covers:
 *  1. Requires people.manage permission
 *  2. Requires active tenant
 *  3. Person not in tenant → 404
 *  4. SquadMember not belonging to person → 404
 *  5. Cross-tenant target rejected (person in different tenant)
 *  6. Successful removal returns 200 with message
 *  7. Person record is never deleted
 *  8. logAction is called with correct metadata
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiActiveTenantId: vi.fn(),
  personFindFirst: vi.fn(),
  playerSquadMemberFindFirst: vi.fn(),
  playerSquadMemberDelete: vi.fn(),
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
    playerSquadMember: {
      findFirst: mocks.playerSquadMemberFindFirst,
      delete: mocks.playerSquadMemberDelete,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({ logAction: mocks.logAction }));

import { DELETE } from "@/app/api/people/[id]/squad-memberships/[squadMemberId]/route";
import { NextRequest } from "next/server";

function makeContext(personId: string, squadMemberId: string) {
  return { params: Promise.resolve({ id: personId, squadMemberId }) };
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

const SQUAD_MEMBER = {
  id: "sm-1",
  personId: "person-09",
  teamSeasonId: "ts-1",
  status: "ACTIVE",
  shirtNumber: null,
  positionLabel: null,
  isCaptain: false,
  isViceCaptain: false,
  teamSeason: {
    id: "ts-1",
    team: { id: "t-f2", name: "Junioren F2" },
    season: { id: "s-1", name: "2026/27", key: "2026-27" },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DELETE /api/people/[id]/squad-memberships/[squadMemberId]", () => {
  it("returns 403 when not authorized", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden." });
    const req = new NextRequest("http://localhost/api/people/p/squad-memberships/sm", { method: "DELETE" });
    const res = await DELETE(req, makeContext("p", "sm"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when no active tenant", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: false, status: 403, error: "No tenant." });
    const req = new NextRequest("http://localhost/api/people/p/squad-memberships/sm", { method: "DELETE" });
    const res = await DELETE(req, makeContext("p", "sm"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when person not in tenant (tenant isolation)", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/people/other/squad-memberships/sm", { method: "DELETE" });
    const res = await DELETE(req, makeContext("other", "sm"));
    expect(res.status).toBe(404);
    expect(mocks.playerSquadMemberDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when squad member does not belong to person", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.playerSquadMemberFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/people/person-09/squad-memberships/sm-other", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09", "sm-other"));
    expect(res.status).toBe(404);
    expect(mocks.playerSquadMemberDelete).not.toHaveBeenCalled();
  });

  it("returns 200 and deletes squad member on success", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.playerSquadMemberFindFirst.mockResolvedValueOnce(SQUAD_MEMBER);
    mocks.playerSquadMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/squad-memberships/sm-1", { method: "DELETE" });
    const res = await DELETE(req, makeContext("person-09", "sm-1"));
    expect(res.status).toBe(200);
    expect(mocks.playerSquadMemberDelete).toHaveBeenCalledWith({ where: { id: "sm-1" } });
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });

  it("never deletes Person record", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.playerSquadMemberFindFirst.mockResolvedValueOnce(SQUAD_MEMBER);
    mocks.playerSquadMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/squad-memberships/sm-1", { method: "DELETE" });
    await DELETE(req, makeContext("person-09", "sm-1"));
    expect(mocks.personDelete).not.toHaveBeenCalled();
  });

  it("logs removal action with person and team metadata", async () => {
    mocks.requireApiPermission.mockResolvedValueOnce(makeAuthorizedAccess());
    mocks.requireApiActiveTenantId.mockResolvedValueOnce({ ok: true, tenantId: "t1" });
    mocks.personFindFirst.mockResolvedValueOnce(PERSON);
    mocks.playerSquadMemberFindFirst.mockResolvedValueOnce(SQUAD_MEMBER);
    mocks.playerSquadMemberDelete.mockResolvedValueOnce({});
    mocks.logAction.mockResolvedValueOnce(undefined);

    const req = new NextRequest("http://localhost/api/people/person-09/squad-memberships/sm-1", { method: "DELETE" });
    await DELETE(req, makeContext("person-09", "sm-1"));

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "PlayerSquadMember",
        entityId: "sm-1",
        action: "squad_membership_removed_from_person_workspace",
        metadataJson: expect.objectContaining({ personId: "person-09" }),
      }),
    );
  });
});
