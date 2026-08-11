/**
 * app/api/matchcenter/[matchId]/__tests__/admin-delete-02a-route.test.ts
 *
 * ADMIN-DELETE-02A — Focused tests for the DELETE /api/matchcenter/[matchId]
 * permanent-delete authorization wiring, mirroring
 * app/api/teams/[teamId]/__tests__/route.test.ts's DELETE suite
 * (ADMIN-DELETE-01B). The resolver's own Club Admin / SCE Super Admin /
 * delegated-user grant logic is exhaustively covered at the resolver
 * level — these tests verify the ROUTE wiring only: the target match's
 * tenant is resolved server-side (never from the client), the resolver is
 * invoked with that exact tenantId + PERMISSIONS.MATCHES_DELETE, and the
 * route's response follows the resolver's decision.
 *
 * A separate mock module registry from ../route.test.ts (PATCH suite) is
 * used deliberately — each test file gets its own isolated vi.mock()
 * registrations, so this file's prisma/auth mocks never interact with the
 * existing PATCH suite's mocks.
 *
 * TEST COVERAGE MAP:
 *   1. Club Admin: allowed within their own tenant.
 *   2. Club Admin: denied for a match in another tenant.
 *   3. SCE Super Admin: allowed for a match in a different, ACTIVE tenant.
 *   4. Delegated user holding only matches.delete: allowed.
 *   5. events.manage-only (no matches.delete): denied.
 *   6. A client-supplied tenantId is ignored — the resolver is always
 *      called with the match's own DB-resolved tenantId.
 *   7. 409 with blockers when the match has meaningful history.
 *   8. 404 when the match does not exist or is not type=MATCH.
 *   9. 401 when there is no session.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  eventFindFirst: vi.fn(),
  deleteMatchSafely: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: (...args: unknown[]) => mocks.eventFindFirst(...args),
    },
    team: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/matchcenter/match-lifecycle-service", () => ({
  deleteMatchSafely: mocks.deleteMatchSafely,
  MatchNotFoundError: class MatchNotFoundError extends Error {},
  MatchDeletionBlockedError: class MatchDeletionBlockedError extends Error {
    blockers: unknown[];
    constructor(blockers: unknown[] = []) {
      super("blocked");
      this.blockers = blockers;
    }
  },
}));

import { DELETE } from "../route";
import { MatchDeletionBlockedError as MockedBlockedError } from "@/lib/matchcenter/match-lifecycle-service";

const MATCH_ID = "match-01";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContext() {
  return { params: Promise.resolve({ matchId: MATCH_ID }) };
}

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(makeAuthSession());
  mocks.eventFindFirst.mockResolvedValue({ id: MATCH_ID, tenantId: TENANT_A });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/matchcenter/[matchId] — ADMIN-DELETE-02A", () => {
  it("1 — Club Admin: allowed within their own tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockResolvedValueOnce({ id: MATCH_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "matches.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteMatchSafely).toHaveBeenCalledWith(TENANT_A, MATCH_ID);
  });

  it("2 — Club Admin: denied for a match belonging to another tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.deleteMatchSafely).not.toHaveBeenCalled();
  });

  it("3 — SCE Super Admin: allowed for a match in a different, ACTIVE tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockResolvedValueOnce({ id: MATCH_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "sce-super-admin-1",
      permission: "matches.delete",
      tenantId: TENANT_B,
    });
  });

  it("4 — delegated user holding only matches.delete: allowed within the granted tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("delegated-user-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockResolvedValueOnce({ id: MATCH_ID });

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.deleteMatchSafely).toHaveBeenCalledWith(TENANT_A, MATCH_ID);
  });

  it("5 — events.manage-only (no matches.delete): denied, never falls back to a MANAGE check", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "matches.delete" }),
    );
    expect(mocks.deleteMatchSafely).not.toHaveBeenCalled();
  });

  it("6 — a client-supplied tenantId (query string) is ignored; the match's own DB tenantId is used", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockResolvedValueOnce({ id: MATCH_ID });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}?tenantId=${TENANT_B}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteMatchSafely).toHaveBeenCalledWith(TENANT_A, MATCH_ID);
  });

  it("7 — 409 with blockers when the match has meaningful history", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockRejectedValueOnce(
      new MockedBlockedError([{ key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 }]),
    );

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([{ key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 }]);
  });

  it("8 — 404 when the match does not exist or is not type=MATCH (never authorizes or deletes)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteMatchSafely).not.toHaveBeenCalled();
  });

  it("8a — scopes the lookup to type: MATCH", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchSafely.mockResolvedValueOnce({ id: MATCH_ID });

    await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "MATCH" }) }),
    );
  });

  it("9 — 401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}`), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
    expect(mocks.deleteMatchSafely).not.toHaveBeenCalled();
  });
});
