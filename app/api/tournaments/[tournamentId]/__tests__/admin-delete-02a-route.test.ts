/**
 * app/api/tournaments/[tournamentId]/__tests__/admin-delete-02a-route.test.ts
 *
 * ADMIN-DELETE-02A — Focused tests for the DELETE
 * /api/tournaments/[tournamentId] permanent-delete authorization wiring,
 * mirroring app/api/teams/[teamId]/__tests__/route.test.ts's DELETE suite
 * (ADMIN-DELETE-01B). The resolver's own Club Admin / SCE Super Admin /
 * delegated-user grant logic is exhaustively covered at the resolver
 * level — these tests verify the ROUTE wiring only.
 *
 * A separate mock module registry from ../route.test.ts (PATCH suite) is
 * used deliberately.
 *
 * TEST COVERAGE MAP:
 *   1. Club Admin: allowed within their own tenant.
 *   2. Club Admin: denied for a tournament in another tenant.
 *   3. SCE Super Admin: allowed for a tournament in a different, ACTIVE tenant.
 *   4. Delegated user holding only tournaments.delete: allowed.
 *   5. events.manage-only (no tournaments.delete): denied.
 *   6. A client-supplied tenantId is ignored — the resolver is always
 *      called with the tournament's own DB-resolved tenantId.
 *   7. 409 with blockers when the tournament has meaningful history.
 *   8. 404 when the tournament does not exist or is not type=TOURNAMENT.
 *   9. 401 when there is no session.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  eventFindFirst: vi.fn(),
  deleteTournamentSafely: vi.fn(),
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
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  updateTournament: vi.fn(),
  cancelTournament: vi.fn(),
  restoreTournament: vi.fn(),
}));

vi.mock("@/lib/tournaments/tournament-lifecycle-service", () => ({
  deleteTournamentSafely: mocks.deleteTournamentSafely,
  TournamentDeletionBlockedError: class TournamentDeletionBlockedError extends Error {
    blockers: unknown[];
    constructor(blockers: unknown[] = []) {
      super("blocked");
      this.blockers = blockers;
    }
  },
}));

import { DELETE } from "../route";
import { TournamentDeletionBlockedError as MockedBlockedError } from "@/lib/tournaments/tournament-lifecycle-service";
import { TournamentNotFoundError } from "@/lib/tournaments/errors";

const TOURNAMENT_ID = "tournament-01";
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeContext() {
  return { params: Promise.resolve({ tournamentId: TOURNAMENT_ID }) };
}

function makeAuthSession(userId = "user-01", effectiveUserId?: string) {
  return { user: { id: userId, effectiveUserId: effectiveUserId ?? userId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(makeAuthSession());
  mocks.eventFindFirst.mockResolvedValue({ id: TOURNAMENT_ID, tenantId: TENANT_A });
  mocks.logAction.mockResolvedValue(undefined);
});

describe("DELETE /api/tournaments/[tournamentId] — ADMIN-DELETE-02A", () => {
  it("1 — Club Admin: allowed within their own tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "club-admin-1",
      permission: "tournaments.delete",
      tenantId: TENANT_A,
    });
    expect(mocks.deleteTournamentSafely).toHaveBeenCalledWith(TENANT_A, TOURNAMENT_ID);
  });

  it("2 — Club Admin: denied for a tournament belonging to another tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.deleteTournamentSafely).not.toHaveBeenCalled();
  });

  it("3 — SCE Super Admin: allowed for a tournament in a different, ACTIVE tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("sce-super-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_B });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith({
      userId: "sce-super-admin-1",
      permission: "tournaments.delete",
      tenantId: TENANT_B,
    });
  });

  it("4 — delegated user holding only tournaments.delete: allowed within the granted tenant", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("delegated-user-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteTournamentSafely).toHaveBeenCalledWith(TENANT_A, TOURNAMENT_ID);
  });

  it("5 — events.manage-only (no tournaments.delete): denied, never falls back to a MANAGE check", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("manage-only-user"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(false);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "tournaments.delete" }),
    );
    expect(mocks.deleteTournamentSafely).not.toHaveBeenCalled();
  });

  it("6 — a client-supplied tenantId (query string) is ignored; the tournament's own DB tenantId is used", async () => {
    mocks.auth.mockResolvedValueOnce(makeAuthSession("club-admin-1"));
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}?tenantId=${TENANT_B}`),
      makeContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    expect(mocks.deleteTournamentSafely).toHaveBeenCalledWith(TENANT_A, TOURNAMENT_ID);
  });

  it("7 — 409 with blockers when the tournament has meaningful history", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockRejectedValueOnce(
      new MockedBlockedError([{ key: "participants", label: "Teilnehmende Teams/Vereine", count: 3 }]),
    );

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([{ key: "participants", label: "Teilnehmende Teams/Vereine", count: 3 }]);
  });

  it("8 — 404 when the tournament does not exist or is not type=TOURNAMENT", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce(null);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(404);
    expect(mocks.hasTenantDeletionAuthority).not.toHaveBeenCalled();
    expect(mocks.deleteTournamentSafely).not.toHaveBeenCalled();
  });

  it("8a — scopes the lookup to type: TOURNAMENT", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockResolvedValueOnce({ id: TOURNAMENT_ID });

    await DELETE(new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`), makeContext());

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: "TOURNAMENT" }) }),
    );
  });

  it("8b — 404 when the tournament is deleted concurrently between authorization and the delete itself", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: TOURNAMENT_ID, tenantId: TENANT_A });
    mocks.hasTenantDeletionAuthority.mockResolvedValueOnce(true);
    mocks.deleteTournamentSafely.mockRejectedValueOnce(new TournamentNotFoundError(TOURNAMENT_ID));

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(404);
  });

  it("9 — 401 when there is no session", async () => {
    mocks.auth.mockResolvedValueOnce(null);

    const response = await DELETE(
      new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}`),
      makeContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
    expect(mocks.deleteTournamentSafely).not.toHaveBeenCalled();
  });
});
