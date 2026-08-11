/**
 * app/api/matchcenter/[matchId]/__tests__/admin-delete-02a-route.test.ts
 *
 * ADMIN-DELETE-02A-C1 — Focused tests for the DELETE /api/matchcenter/[matchId]
 * permanent-delete authorization wiring AND the two-step "preview impact →
 * explicit confirm" flow. The resolver's own Club Admin / SCE Super Admin /
 * delegated-user grant logic is exhaustively covered at the resolver
 * level — these tests verify the ROUTE wiring only.
 *
 * A separate mock module registry from ../route.test.ts (PATCH suite) is
 * used deliberately — each test file gets its own isolated vi.mock()
 * registrations, so this file's prisma/auth mocks never interact with the
 * existing PATCH suite's mocks.
 *
 * TEST COVERAGE MAP:
 *   1. Club Admin: allowed within their own tenant (confirm=true deletes).
 *   2. Club Admin: denied for a match in another tenant.
 *   3. SCE Super Admin: allowed for a match in a different, ACTIVE tenant.
 *   4. Delegated user holding only matches.delete: allowed.
 *   5. events.manage-only (no matches.delete): denied.
 *   6. A client-supplied tenantId is ignored — the resolver is always
 *      called with the match's own DB-resolved tenantId.
 *   7. Without confirm=true: returns 200 with impact + requiresConfirmation,
 *      and NEVER calls deleteMatchPermanently — even when the match has an
 *      SFV/provider mapping (never blocked, never auto-deleted).
 *   8. 404 when the match does not exist or is not type=MATCH.
 *   9. 401 when there is no session.
 *  10. With confirm=true: deletion proceeds even though a provider mapping
 *      exists (never blocked for an authorized caller).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  eventFindFirst: vi.fn(),
  deleteMatchPermanently: vi.fn(),
  getMatchDeletionImpact: vi.fn(),
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
  deleteMatchPermanently: mocks.deleteMatchPermanently,
  getMatchDeletionImpact: mocks.getMatchDeletionImpact,
  MatchNotFoundError: class MatchNotFoundError extends Error {},
}));

import { DELETE } from "../route";
import { MatchNotFoundError } from "@/lib/matchcenter/match-lifecycle-service";

const MATCH_ID = "match-01";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContext() {
  return { params: Promise.resolve({ matchId: MATCH_ID }) };
}

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

function makeUrl(confirm?: boolean) {
  const base = `http://localhost/api/matchcenter/${MATCH_ID}`;
  return confirm ? `${base}?confirm=true` : base;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(makeAuthSession());
  mocks.eventFindFirst.mockResolvedValue({ id: MATCH_ID, tenantId: TENANT_A });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.getMatchDeletionImpact.mockResolvedValue([]);
});

describe("DELETE /api/matchcenter/[matchId] — ADMIN-DELETE-02A-C1", () => {
  it("1 — Club Admin: allowed within their own tenant (confirm=true deletes)", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockResolvedValueOnce({ deleted: { id: MATCH_ID }, impact: [] });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "matches.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteMatchPermanently).toHaveBeenCalledWith(
      TENANT_A,
      MATCH_ID,
      "club-admin-1",
    );
  });

  it("2 — Club Admin: denied for a match belonging to another tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.deleteMatchPermanently).not.toHaveBeenCalled();
  });

  it("3 — SCE Super Admin: allowed for a match in a different, ACTIVE tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockResolvedValueOnce({ deleted: { id: MATCH_ID }, impact: [] });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

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
    mocks.deleteMatchPermanently.mockResolvedValueOnce({ deleted: { id: MATCH_ID }, impact: [] });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(200);
    expect(mocks.deleteMatchPermanently).toHaveBeenCalledWith(
      TENANT_A,
      MATCH_ID,
      "delegated-user-1",
    );
  });

  it("5 — events.manage-only (no matches.delete): denied, never falls back to a MANAGE check", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "matches.delete" }),
    );
    expect(mocks.deleteMatchPermanently).not.toHaveBeenCalled();
  });

  it("6 — a client-supplied tenantId (query string) is ignored; the match's own DB tenantId is used", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockResolvedValueOnce({ deleted: { id: MATCH_ID }, impact: [] });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/matchcenter/${MATCH_ID}?confirm=true&tenantId=${TENANT_B}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteMatchPermanently).toHaveBeenCalledWith(TENANT_A, MATCH_ID, "club-admin-1");
  });

  it("7 — without confirm=true: returns impact and NEVER deletes, even with an SFV/provider mapping", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.getMatchDeletionImpact.mockResolvedValueOnce([
      { key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 },
    ]);

    const response = await DELETE(new NextRequest(makeUrl(false)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact).toEqual([
      { key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 },
    ]);
    expect(mocks.deleteMatchPermanently).not.toHaveBeenCalled();
  });

  it("8 — 404 when the match does not exist or is not type=MATCH (never authorizes or deletes)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteMatchPermanently).not.toHaveBeenCalled();
  });

  it("8a — scopes the lookup to type: MATCH", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockResolvedValueOnce({ deleted: { id: MATCH_ID }, impact: [] });

    await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "MATCH" }) }),
    );
  });

  it("9 — 401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(401);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
    expect(mocks.deleteMatchPermanently).not.toHaveBeenCalled();
  });

  it("10 — with confirm=true: deletion proceeds even though a provider mapping exists (never blocked)", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockResolvedValueOnce({
      deleted: { id: MATCH_ID },
      impact: [{ key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 }],
    });

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.impact).toEqual([
      { key: "providerMapping", label: "Anbieter-/SFV-Zuordnung", count: 1 },
    ]);
    expect(mocks.deleteMatchPermanently).toHaveBeenCalled();
  });

  it("8b — 404 when the match is deleted concurrently between authorization and the delete itself", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: MATCH_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteMatchPermanently.mockRejectedValueOnce(new MatchNotFoundError(MATCH_ID));

    const response = await DELETE(new NextRequest(makeUrl(true)), makeContext());

    expect(response.status).toBe(404);
  });
});
