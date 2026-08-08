/**
 * Tests for POST /api/events
 *
 * Focused regression coverage for the TOURNAMENTCENTER-01 tenant-isolation
 * fix: newly created Events (including tournaments) must be stamped with
 * the acting session's tenantId. Before this fix, every manually created
 * Event had tenantId=null, making it invisible to tenant-scoped consumers
 * such as TournamentCenter (lib/tournaments/queries.ts) and Matchcenter
 * (lib/matchcenter/query-service.ts), both of which require a non-null,
 * matching tenantId.
 *
 * Does not re-test the full review-workflow/recurrence surface — see
 * lib/workflow/__tests__ and lib/events/__tests__ for that coverage.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  seasonFindUnique: vi.fn(),
  teamFindUnique: vi.fn(),
  eventCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));

// GET (not under test here) also uses this at module scope — must be mocked
// too, otherwise the real module pulls in @/auth -> next-auth at import time.
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: mocks.seasonFindUnique },
    team: { findUnique: mocks.teamFindUnique },
    event: { create: mocks.eventCreate },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ event: { create: mocks.eventCreate } }),
  },
}));

import { POST } from "../route";

const BASE_URL = "http://localhost/api/events";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_SESSION = {
  ok: true,
  status: 200,
  error: null,
  session: {
    user: {
      id: "user-1",
      activeTenantId: "tenant-1",
      permissionKeys: [],
    },
  },
};

const VALID_BODY = {
  type: "TOURNAMENT",
  source: "MANUAL",
  seasonId: "season-1",
  teamId: "team-1",
  title: "E1 Hallenturnier",
  startAt: "2026-09-05T10:00:00.000Z",
  organizerName: "FC Aesch",
};

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue(VALID_SESSION);
    mocks.seasonFindUnique.mockResolvedValue({ id: "season-1", key: "2026-27", name: "2026/27" });
    mocks.teamFindUnique.mockResolvedValue({ id: "team-1" });
    mocks.eventCreate.mockResolvedValue({
      id: "event-1",
      title: "E1 Hallenturnier",
      type: "TOURNAMENT",
      source: "MANUAL",
      status: "SCHEDULED",
      reviewStage: "SUBMITTED",
      reviewRequestedAt: new Date(),
      reviewedAt: null,
      seasonId: "season-1",
      teamId: "team-1",
      startAt: new Date("2026-09-05T10:00:00.000Z"),
      endAt: null,
      meetingTime: null,
    });
  });

  it("stamps tenantId from the session onto the created Event", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);

    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBe("tenant-1");
  });

  it("never reads tenantId from the request body", async () => {
    await POST(makeRequest({ ...VALID_BODY, tenantId: "attacker-tenant" }));

    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBe("tenant-1");
  });

  it("sets tenantId to null when the session has no active tenant (legacy/platform-only actor)", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", activeTenantId: null, permissionKeys: [] } },
    });

    await POST(makeRequest(VALID_BODY));

    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.tenantId).toBeNull();
  });

  it("returns 401/403 without creating an Event when unauthorized", async () => {
    mocks.requireApiPermission.mockResolvedValue({ ok: false, status: 403, error: "Forbidden", session: null });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
