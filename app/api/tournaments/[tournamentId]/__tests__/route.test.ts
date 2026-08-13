/**
 * Tests for PATCH /api/tournaments/[tournamentId]
 *
 * Independently validates:
 * - Authentication / permission enforcement
 * - Tenant isolation (cross-tenant / missing tenant rejection)
 * - Field update pass-through to the service layer
 * - Lifecycle transitions (cancel/restore) via `status`
 * - Error mapping (not found, validation, invalid transition)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ORG-ACCESS-03: route now uses auth() + planning policy instead of requireApiAnyPermission.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canEditPlanningRecord: vi.fn(),
  eventFindFirst: vi.fn(),
  updateTournament: vi.fn(),
  cancelTournament: vi.fn(),
  restoreTournament: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/planning/planning-authorization-policy", () => ({
  createPlanningAuthorizationPolicy: () => ({
    canEditPlanningRecord: mocks.canEditPlanningRecord,
  }),
}));

vi.mock("@/lib/tournaments/tournament-service", () => ({
  updateTournament: mocks.updateTournament,
  cancelTournament: mocks.cancelTournament,
  restoreTournament: mocks.restoreTournament,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

// ORG-ACCESS-03: tournament route now loads the event for scope check.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findFirst: mocks.eventFindFirst },
  },
}));

import { PATCH } from "../route";
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentInvalidTransitionError,
} from "@/lib/tournaments/errors";

const BASE_URL = "http://localhost/api/tournaments/tournament-test-1";

type RouteContext = { params: Promise<{ tournamentId: string }> };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(tournamentId = "tournament-test-1"): RouteContext {
  return { params: Promise.resolve({ tournamentId }) };
}

const VALID_AUTH_SESSION = {
  user: { id: "user-1", activeTenantId: "tenant-1" },
};

const VALID_TOURNAMENT = { id: "tournament-test-1", title: "E1 Hallenturnier", status: "SCHEDULED" };

// ORG-ACCESS-03: event needs source/teamId/reviewStage for scope check.
const VALID_EVENT_ROW = {
  id: "tournament-test-1",
  source: "MANUAL",
  teamId: "team-fca",
  reviewStage: "DRAFT",
};

describe("PATCH /api/tournaments/[tournamentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ORG-ACCESS-03: auth() and planning policy replace requireApiAnyPermission.
    mocks.auth.mockResolvedValue(VALID_AUTH_SESSION);
    mocks.canEditPlanningRecord.mockResolvedValue(true);
    mocks.eventFindFirst.mockResolvedValue(VALID_EVENT_ROW);
    mocks.updateTournament.mockResolvedValue(VALID_TOURNAMENT);
    mocks.cancelTournament.mockResolvedValue({ ...VALID_TOURNAMENT, status: "CANCELLED" });
    mocks.restoreTournament.mockResolvedValue({ ...VALID_TOURNAMENT, status: "SCHEDULED" });
  });

  // ── Authentication / permission ──────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ title: "X" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 403 when planning policy denies edit (no scope for team)", async () => {
    mocks.canEditPlanningRecord.mockResolvedValue(false);

    const res = await PATCH(makeRequest({ title: "X" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns 403 when tenantId is missing from session", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: null } });

    const res = await PATCH(makeRequest({ title: "X" }), makeContext());
    expect(res.status).toBe(403);
  });

  // ── Field update ──────────────────────────────────────────────────────────────

  it("passes tenantId (from session, never body) and tournamentId to updateTournament", async () => {
    await PATCH(makeRequest({ title: "Neuer Titel" }), makeContext("tournament-test-1"));

    expect(mocks.updateTournament).toHaveBeenCalledWith(
      "tenant-1",
      "tournament-test-1",
      expect.objectContaining({ title: "Neuer Titel" }),
    );
  });

  it("parses date fields to Date instances", async () => {
    await PATCH(
      makeRequest({ startAt: "2026-09-05T16:00:00.000Z", endAt: "2026-09-05T20:00:00.000Z" }),
      makeContext(),
    );

    const call = mocks.updateTournament.mock.calls[0]![2];
    expect(call.startAt).toBeInstanceOf(Date);
    expect(call.endAt).toBeInstanceOf(Date);
  });

  it("returns 400 for an invalid startAt", async () => {
    const res = await PATCH(makeRequest({ startAt: "not-a-date" }), makeContext());
    expect(res.status).toBe(400);
    expect(mocks.updateTournament).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty title", async () => {
    const res = await PATCH(makeRequest({ title: "   " }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 when no valid fields are provided", async () => {
    const res = await PATCH(makeRequest({ unknownField: "value" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid boolean visibility field", async () => {
    const res = await PATCH(makeRequest({ websiteVisible: "yes" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("accepts null for optional string fields (clearing them)", async () => {
    const res = await PATCH(makeRequest({ location: null, teamId: null }), makeContext());
    expect(res.status).toBe(200);

    const call = mocks.updateTournament.mock.calls[0]![2];
    expect(call.location).toBeNull();
    expect(call.teamId).toBeNull();
  });

  it("passes a valid homeAway value through", async () => {
    const res = await PATCH(makeRequest({ homeAway: "AWAY" }), makeContext());
    expect(res.status).toBe(200);

    const call = mocks.updateTournament.mock.calls[0]![2];
    expect(call.homeAway).toBe("AWAY");
  });

  it("rejects an invalid homeAway value", async () => {
    const res = await PATCH(makeRequest({ homeAway: "BOTH" }), makeContext());
    expect(res.status).toBe(400);
    expect(mocks.updateTournament).not.toHaveBeenCalled();
  });

  it("maps TournamentNotFoundError to 404", async () => {
    mocks.updateTournament.mockRejectedValue(new TournamentNotFoundError("tournament-test-1"));

    const res = await PATCH(makeRequest({ title: "X" }), makeContext());
    expect(res.status).toBe(404);
  });

  it("maps TournamentValidationError to 400", async () => {
    mocks.updateTournament.mockRejectedValue(new TournamentValidationError("bad input"));

    const res = await PATCH(makeRequest({ title: "X" }), makeContext());
    expect(res.status).toBe(400);
  });

  // ── Lifecycle transitions ────────────────────────────────────────────────────

  it("cancels a tournament when status=CANCELLED", async () => {
    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeContext());
    expect(res.status).toBe(200);
    expect(mocks.cancelTournament).toHaveBeenCalledWith("tenant-1", "tournament-test-1");
    expect(mocks.updateTournament).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.tournament.status).toBe("CANCELLED");
  });

  it("restores a tournament when status=SCHEDULED", async () => {
    const res = await PATCH(makeRequest({ status: "SCHEDULED" }), makeContext());
    expect(res.status).toBe(200);
    expect(mocks.restoreTournament).toHaveBeenCalledWith("tenant-1", "tournament-test-1");
  });

  it("rejects an unsupported status value", async () => {
    const res = await PATCH(makeRequest({ status: "ARCHIVED" }), makeContext());
    expect(res.status).toBe(400);
    expect(mocks.cancelTournament).not.toHaveBeenCalled();
    expect(mocks.restoreTournament).not.toHaveBeenCalled();
  });

  it("maps TournamentInvalidTransitionError to 422", async () => {
    mocks.cancelTournament.mockRejectedValue(new TournamentInvalidTransitionError("cannot cancel"));

    const res = await PATCH(makeRequest({ status: "CANCELLED" }), makeContext());
    expect(res.status).toBe(422);
  });
});
