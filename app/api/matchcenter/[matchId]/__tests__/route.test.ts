/**
 * Tests for PATCH /api/matchcenter/[matchId]
 *
 * Independently validates security requirements:
 * - Authentication enforcement
 * - Tenant isolation (cross-tenant write rejection)
 * - Permission enforcement (read-only rejection)
 * - Field whitelist (SFV-owned fields not updatable)
 * - Cross-entity tenant validation (team belongs to same tenant)
 * - Unknown event rejection
 * - Invalid team rejection
 * - Field persistence (all 6 mutable fields accepted)
 */

import { NextRequest } from "next/server";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  eventFindFirst: vi.fn(),
  teamFindFirst: vi.fn(),
  eventUpdate: vi.fn(),
}));

vi.mock(
  "@/lib/permissions/require-api-any-permission",
  () => ({
    requireApiAnyPermission: mocks.requireApiAnyPermission,
  }),
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      update: mocks.eventUpdate,
    },
    team: {
      findFirst: mocks.teamFindFirst,
    },
  },
}));

import { PATCH } from "../route";

const BASE_URL =
  "http://localhost/api/matchcenter/match-test-1";

type RouteContext = {
  params: Promise<{ matchId: string }>;
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(matchId = "match-test-1"): RouteContext {
  return {
    params: Promise.resolve({ matchId }),
  };
}

const VALID_SESSION = {
  ok: true,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      tenantId: "tenant-1",
    },
  },
};

const VALID_EVENT = { id: "match-test-1" };
const VALID_TEAM = { id: "team-fca" };

const VALID_UPDATED_EVENT = {
  id: "match-test-1",
  teamId: "team-fca",
  pitchCode: "STADION",
  homeDressingRoomCode: "E1",
  awayDressingRoomCode: "E2",
  websiteVisible: true,
  infoboardVisible: true,
};

describe("PATCH /api/matchcenter/[matchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(VALID_SESSION);
    mocks.eventFindFirst.mockResolvedValue(VALID_EVENT);
    mocks.teamFindFirst.mockResolvedValue(VALID_TEAM);
    mocks.eventUpdate.mockResolvedValue(VALID_UPDATED_EVENT);
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const res = await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext(),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when permission is insufficient (read-only)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const res = await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext(),
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 when tenantId is missing from session", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: {
        user: {
          id: "user-1",
          tenantId: null,
        },
      },
    });

    const res = await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext(),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Tenant context is required.");
  });

  // ── Cross-tenant rejection ─────────────────────────────────────────────────

  it("returns 404 for an event belonging to a different tenant", async () => {
    // Simulate event not found for this tenant (cross-tenant attempt)
    mocks.eventFindFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext("other-tenant-event-id"),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Match nicht gefunden.");
  });

  it("confirms tenantId is used in event lookup (not just matchId)", async () => {
    await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext("match-test-1"),
    );

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  // ── Unknown event ─────────────────────────────────────────────────────────

  it("returns 404 for an unknown matchId", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ pitchCode: "STADION" }),
      makeContext("nonexistent-match"),
    );

    expect(res.status).toBe(404);
  });

  // ── Team tenant isolation ─────────────────────────────────────────────────

  it("returns 404 when teamId belongs to a different tenant", async () => {
    mocks.teamFindFirst.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest({ teamId: "other-tenant-team" }),
      makeContext(),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe(
      "Team nicht gefunden oder nicht zugreifbar.",
    );
  });

  it("validates teamId against tenant when provided", async () => {
    await PATCH(
      makeRequest({ teamId: "team-fca" }),
      makeContext(),
    );

    expect(mocks.teamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "team-fca",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("skips team validation when teamId is null", async () => {
    const res = await PATCH(
      makeRequest({ teamId: null }),
      makeContext(),
    );

    expect(mocks.teamFindFirst).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  // ── Field whitelist ────────────────────────────────────────────────────────

  it("updates all 6 approved locally-managed fields", async () => {
    const body = {
      teamId: "team-fca",
      pitchCode: "STADION",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: "E2",
      websiteVisible: false,
      infoboardVisible: true,
    };

    const res = await PATCH(makeRequest(body), makeContext());

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "team-fca",
          pitchCode: "STADION",
          homeDressingRoomCode: "E1",
          awayDressingRoomCode: "E2",
          websiteVisible: false,
          infoboardVisible: true,
        }),
      }),
    );
  });

  it("SFV-owned field homeAway is not writable", async () => {
    const res = await PATCH(
      makeRequest({ homeAway: "AWAY", pitchCode: "STADION" }),
      makeContext(),
    );

    // Request succeeds but homeAway is not included in update data
    expect(res.status).toBe(200);
    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("homeAway");
  });

  it("SFV-owned field competitionLabel is not writable", async () => {
    const res = await PATCH(
      makeRequest({
        competitionLabel: "Injected Competition",
        pitchCode: "STADION",
      }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("competitionLabel");
  });

  it("SFV-owned field title is not writable", async () => {
    const res = await PATCH(
      makeRequest({ title: "Injected Title", pitchCode: "STADION" }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("title");
  });

  it("returns 400 when no valid fields are provided", async () => {
    const res = await PATCH(
      makeRequest({ unknownField: "value" }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid boolean websiteVisible", async () => {
    const res = await PATCH(
      makeRequest({ websiteVisible: "yes" }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid boolean infoboardVisible", async () => {
    const res = await PATCH(
      makeRequest({ infoboardVisible: 1 }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  it("persists pitchCode correctly", async () => {
    await PATCH(makeRequest({ pitchCode: "KUNSTRASEN_2" }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.pitchCode).toBe("KUNSTRASEN_2");
  });

  it("persists homeDressingRoomCode correctly", async () => {
    await PATCH(
      makeRequest({ homeDressingRoomCode: "O1" }),
      makeContext(),
    );

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.homeDressingRoomCode).toBe("O1");
  });

  it("persists awayDressingRoomCode correctly", async () => {
    await PATCH(
      makeRequest({ awayDressingRoomCode: "O2" }),
      makeContext(),
    );

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.awayDressingRoomCode).toBe("O2");
  });

  it("persists websiteVisible false", async () => {
    await PATCH(makeRequest({ websiteVisible: false }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.websiteVisible).toBe(false);
  });

  it("persists infoboardVisible true", async () => {
    await PATCH(makeRequest({ infoboardVisible: true }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.infoboardVisible).toBe(true);
  });

  it("sets field to null when empty string provided (coerced)", async () => {
    await PATCH(makeRequest({ pitchCode: "" }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.pitchCode).toBeNull();
  });

  it("sets field to null when null provided", async () => {
    await PATCH(makeRequest({ pitchCode: null }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data.pitchCode).toBeNull();
  });

  // ── Partial update ─────────────────────────────────────────────────────────

  it("does not touch omitted fields (partial update)", async () => {
    await PATCH(makeRequest({ pitchCode: "STADION" }), makeContext());

    const updateCall = mocks.eventUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("teamId");
    expect(updateCall.data).not.toHaveProperty("websiteVisible");
    expect(updateCall.data).not.toHaveProperty("infoboardVisible");
  });
});
