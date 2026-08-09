/**
 * app/api/tournaments/[tournamentId]/participants/__tests__/route.test.ts
 *
 * API regression tests for the TOURNAMENTCENTER-01B participants route.
 *
 * GET  /api/tournaments/:tournamentId/participants
 * POST /api/tournaments/:tournamentId/participants
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  listTournamentParticipants: vi.fn(),
  addTournamentParticipant: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/tournaments/participant-service", () => ({
  listTournamentParticipants: mocks.listTournamentParticipants,
  addTournamentParticipant: mocks.addTournamentParticipant,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { GET, POST } from "../route";
import {
  TournamentNotFoundError,
  TournamentParticipantValidationError,
  TournamentParticipantTenantMismatchError,
  TournamentParticipantDuplicateError,
} from "@/lib/tournaments/errors";

const TENANT_A = "tenant-a";
const TOURNAMENT_ID = "tournament-01";

function makeAuthOk(tenantId: string | null = TENANT_A) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: tenantId } },
  };
}

function makeAuthFail(status = 401) {
  return { ok: false as const, status, error: "Unauthorized", session: null };
}

function makeParticipantDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "participant-01",
    tournamentId: TOURNAMENT_ID,
    kind: "TEAM",
    displayName: "FC Allschwil E1",
    team: { id: "team-1", name: "FC Allschwil E1", slug: "e1", category: "JUNIOR", genderGroup: null, ageGroup: "E" },
    externalTeam: null,
    manualLabel: null,
    displayOrder: 0,
    dressingRoomAllocations: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}/participants`, { method: "GET" });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ tournamentId: TOURNAMENT_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
  mocks.listTournamentParticipants.mockResolvedValue([]);
  mocks.addTournamentParticipant.mockResolvedValue(makeParticipantDto());
});

describe("GET /api/tournaments/:tournamentId/participants", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when tenant context is missing", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(null));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when the tournament is not found for this tenant", async () => {
    mocks.listTournamentParticipants.mockRejectedValue(new TournamentNotFoundError(TOURNAMENT_ID));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns the participant list, scoped by tenantId from session", async () => {
    mocks.listTournamentParticipants.mockResolvedValue([makeParticipantDto(), makeParticipantDto({ id: "p2" })]);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.participants).toHaveLength(2);
    expect(mocks.listTournamentParticipants).toHaveBeenCalledWith(TENANT_A, TOURNAMENT_ID);
  });
});

describe("POST /api/tournaments/:tournamentId/participants", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail());
    const res = await POST(makePostRequest({ teamId: "team-1" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid JSON body", async () => {
    const req = new NextRequest(`http://localhost/api/tournaments/${TOURNAMENT_ID}/participants`, {
      method: "POST",
      body: "not-json-{{",
    });
    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created participant on success", async () => {
    const res = await POST(makePostRequest({ teamId: "team-1" }), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.participant.id).toBe("participant-01");
  });

  it("passes tenantId (from session) and tournamentId (from URL) to the service", async () => {
    await POST(makePostRequest({ externalTeamId: "ext-1" }), makeParams());
    expect(mocks.addTournamentParticipant).toHaveBeenCalledWith(
      TENANT_A,
      TOURNAMENT_ID,
      expect.objectContaining({ externalTeamId: "ext-1" }),
    );
  });

  it("returns 404 when the tournament is not found", async () => {
    mocks.addTournamentParticipant.mockRejectedValue(new TournamentNotFoundError(TOURNAMENT_ID));
    const res = await POST(makePostRequest({ teamId: "team-1" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 for a validation error (e.g. none/multiple of team/externalTeam/manual)", async () => {
    mocks.addTournamentParticipant.mockRejectedValue(
      new TournamentParticipantValidationError("Exactly one of teamId, externalTeamId, or manualLabel must be provided."),
    );
    const res = await POST(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for a cross-tenant Team/ExternalTeam reference", async () => {
    mocks.addTournamentParticipant.mockRejectedValue(
      new TournamentParticipantTenantMismatchError("teamId does not belong to this tenant"),
    );
    const res = await POST(makePostRequest({ teamId: "other-tenant-team" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate participant", async () => {
    mocks.addTournamentParticipant.mockRejectedValue(
      new TournamentParticipantDuplicateError('Team "team-1" already participates in this tournament.'),
    );
    const res = await POST(makePostRequest({ teamId: "team-1" }), makeParams());
    expect(res.status).toBe(409);
  });
});
