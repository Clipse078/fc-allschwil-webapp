/**
 * ADMIN-MASTERDATA-UX-01-C1 — /api/people/[id]/link-user route tests.
 *
 * Verifies request/response plumbing, the roles.assign/roles.manage
 * authority gate (test 8: unauthorized caller cannot link/unlink), and
 * domain-error -> HTTP mapping. Business logic itself is covered live in
 * lib/people/__tests__/admin-masterdata-ux-01-c1-person-user-link.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  linkPersonToUser: vi.fn(),
  unlinkPersonFromUser: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/people/mutations", () => ({
  linkPersonToUser: mocks.linkPersonToUser,
  unlinkPersonFromUser: mocks.unlinkPersonFromUser,
}));

import { DELETE, POST } from "@/app/api/people/[id]/link-user/route";
import { UserAlreadyLinkedError, UserNotEligibleError } from "@/lib/people/errors";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "tenant-session";
const ACTOR_USER_ID = "actor-1";
const PERSON_ID = "person-1";

function mockAuthorized() {
  mocks.requireApiAnyPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: { user: { id: ACTOR_USER_ID, activeTenantId: SESSION_TENANT_ID } },
  });
}

function ctx() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/people/[id]/link-user", () => {
  it("links using the session-derived tenantId, never a body-supplied one", async () => {
    mockAuthorized();
    mocks.linkPersonToUser.mockResolvedValue({ personId: PERSON_ID, userId: "user-1" });

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1", tenantId: "attacker-tenant" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    const body = await res.json();

    expect(mocks.linkPersonToUser).toHaveBeenCalledWith({
      personId: PERSON_ID,
      userId: "user-1",
      tenantId: SESSION_TENANT_ID,
      actorUserId: ACTOR_USER_ID,
    });
    expect(body.userId).toBe("user-1");
  });

  it("8. returns 403 and never calls linkPersonToUser when the caller lacks roles.manage/roles.assign", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, ctx());
    expect(res.status).toBe(403);
    expect(mocks.linkPersonToUser).not.toHaveBeenCalled();
  });

  it("returns 400 when userId is missing", async () => {
    mockAuthorized();
    const req = new NextRequest("http://localhost/api/people/person-1/link-user", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(mocks.linkPersonToUser).not.toHaveBeenCalled();
  });

  it("maps UserNotEligibleError to 409", async () => {
    mockAuthorized();
    mocks.linkPersonToUser.mockRejectedValue(new UserNotEligibleError());

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("USER_NOT_ELIGIBLE");
  });

  it("maps UserAlreadyLinkedError to 409", async () => {
    mockAuthorized();
    mocks.linkPersonToUser.mockRejectedValue(new UserAlreadyLinkedError());

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/people/[id]/link-user", () => {
  it("delegates unlinking with the session-derived actor id", async () => {
    mockAuthorized();
    mocks.unlinkPersonFromUser.mockResolvedValue({ unlinked: true });

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", { method: "DELETE" });
    const res = await DELETE(req, ctx());
    const body = await res.json();

    expect(mocks.unlinkPersonFromUser).toHaveBeenCalledWith({ personId: PERSON_ID, actorUserId: ACTOR_USER_ID });
    expect(body.unlinked).toBe(true);
  });

  it("8. returns 403 and never calls unlinkPersonFromUser when the caller lacks roles.manage/roles.assign", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const req = new NextRequest("http://localhost/api/people/person-1/link-user", { method: "DELETE" });
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(403);
    expect(mocks.unlinkPersonFromUser).not.toHaveBeenCalled();
  });
});
