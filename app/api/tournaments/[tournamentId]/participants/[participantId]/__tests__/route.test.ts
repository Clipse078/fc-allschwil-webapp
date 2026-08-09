/**
 * app/api/tournaments/[tournamentId]/participants/[participantId]/__tests__/route.test.ts
 *
 * DELETE /api/tournaments/:tournamentId/participants/:participantId
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  getTournamentParticipant: vi.fn(),
  removeTournamentParticipant: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/tournaments/participant-service", () => ({
  getTournamentParticipant: mocks.getTournamentParticipant,
  removeTournamentParticipant: mocks.removeTournamentParticipant,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { DELETE } from "../route";
import { TournamentParticipantNotFoundError } from "@/lib/tournaments/errors";

const TENANT_A = "tenant-a";
const TOURNAMENT_ID = "tournament-01";
const OTHER_TOURNAMENT_ID = "tournament-02";
const PARTICIPANT_ID = "participant-01";

function makeAuthOk() {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: TENANT_A } },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/tournaments/${TOURNAMENT_ID}/participants/${PARTICIPANT_ID}`,
    { method: "DELETE" },
  );
}

function makeParams(tournamentId = TOURNAMENT_ID, participantId = PARTICIPANT_ID) {
  return { params: Promise.resolve({ tournamentId, participantId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.getTournamentParticipant.mockResolvedValue({ id: PARTICIPANT_ID, tournamentId: TOURNAMENT_ID });
  mocks.removeTournamentParticipant.mockResolvedValue(undefined);
});

describe("DELETE /api/tournaments/:tournamentId/participants/:participantId", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized", session: null });
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("removes the participant and returns ok:true", async () => {
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mocks.removeTournamentParticipant).toHaveBeenCalledWith(TENANT_A, PARTICIPANT_ID);
  });

  it("returns 404 when the participant does not belong to the URL's tournament", async () => {
    mocks.getTournamentParticipant.mockResolvedValue({ id: PARTICIPANT_ID, tournamentId: OTHER_TOURNAMENT_ID });
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
    expect(mocks.removeTournamentParticipant).not.toHaveBeenCalled();
  });

  it("returns 404 when the participant is not found (cross-tenant or unknown)", async () => {
    mocks.getTournamentParticipant.mockRejectedValue(new TournamentParticipantNotFoundError(PARTICIPANT_ID));
    const res = await DELETE(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });
});
