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

// ORG-ACCESS-03: route now uses auth() + planning policy instead of requireApiPermission.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canCreateForTeam: vi.fn(),
  seasonFindUnique: vi.fn(),
  teamFindUnique: vi.fn(),
  externalClubFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  auditLogCreate: vi.fn(),
  tenantFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

// GET (not under test here) still uses requireApiAnyPermission — must be mocked.
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: vi.fn().mockResolvedValue({ ok: false, status: 401, error: "Unauthorized", session: null }),
}));

vi.mock("@/lib/planning/planning-authorization-policy", () => ({
  createPlanningAuthorizationPolicy: () => ({
    canCreateForTeam: mocks.canCreateForTeam,
  }),
}));

// Mock effective permission resolver for non-planning types (not used in these tests, but imported).
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: vi.fn().mockResolvedValue({ platform: [], tenant: [] }),
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    season: { findUnique: mocks.seasonFindUnique },
    team: { findUnique: mocks.teamFindUnique },
    externalClub: { findFirst: mocks.externalClubFindFirst },
    event: { create: mocks.eventCreate },
    tenant: { findUnique: mocks.tenantFindUnique },
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

// ORG-ACCESS-03: auth() returns Session shape directly.
const VALID_AUTH_SESSION = {
  user: {
    id: "user-1",
    activeTenantId: "tenant-1",
    permissionKeys: [],
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

const MATCH_BODY = {
  type: "MATCH",
  source: "MANUAL",
  seasonId: "season-1",
  teamId: "team-1",
  title: "1. Mannschaft vs. FC Telegraph",
  startAt: "2026-09-05T10:00:00.000Z",
  homeAway: "HOME",
};

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ORG-ACCESS-03: auth() and planning policy replace requireApiPermission.
    mocks.auth.mockResolvedValue(VALID_AUTH_SESSION);
    mocks.canCreateForTeam.mockResolvedValue({
      allowed: true,
      isCoordinator: true,
      isScoped: false,
    });
    mocks.seasonFindUnique.mockResolvedValue({ id: "season-1", key: "2026-27", name: "2026/27" });
    mocks.teamFindUnique.mockResolvedValue({ id: "team-1" });
    mocks.tenantFindUnique.mockResolvedValue({ timezone: "Europe/Zurich" });
    mocks.eventCreate.mockResolvedValue({
      id: "event-1",
      title: "E1 Hallenturnier",
      type: "TOURNAMENT",
      source: "MANUAL",
      status: "SCHEDULED",
      reviewStage: "APPROVED",
      reviewRequestedAt: null,
      reviewedAt: new Date(),
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

  it("parses tournament datetime-local startAt in tenant timezone (summer 13:30 → 11:30Z)", async () => {
    const res = await POST(
      makeRequest({
        ...VALID_BODY,
        startAt: "2026-08-30T13:30",
        endAt: "2026-08-30T15:00",
        meetingTime: "2026-08-30T12:45",
      }),
    );
    expect(res.status).toBe(201);

    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect((call.data.startAt as Date).toISOString()).toBe("2026-08-30T11:30:00.000Z");
    expect((call.data.endAt as Date).toISOString()).toBe("2026-08-30T13:00:00.000Z");
    expect((call.data.meetingTime as Date).toISOString()).toBe("2026-08-30T10:45:00.000Z");
  });

  it("sets tenantId to null when the session has no active tenant (legacy/platform-only actor)", async () => {
    // ORG-ACCESS-03: no tenantId → 403 (tenant context required for planning scope check).
    mocks.auth.mockResolvedValue({ user: { id: "user-1", activeTenantId: null, permissionKeys: [] } });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("returns 403 without creating an Event when planning policy denies creation", async () => {
    mocks.canCreateForTeam.mockResolvedValue({
      allowed: false,
      isCoordinator: false,
      isScoped: false,
      reason: "Keine Berechtigung.",
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/events — MATCHCENTER-CANONICAL-OPPONENT-01B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(VALID_AUTH_SESSION);
    mocks.canCreateForTeam.mockResolvedValue({
      allowed: true,
      isCoordinator: true,
      isScoped: false,
    });
    mocks.seasonFindUnique.mockResolvedValue({ id: "season-1", key: "2026-27", name: "2026/27" });
    mocks.teamFindUnique.mockResolvedValue({ id: "team-1" });
    mocks.eventCreate.mockResolvedValue({
      id: "event-match-1",
      title: "Match",
      type: "MATCH",
      source: "MANUAL",
      status: "SCHEDULED",
      reviewStage: "APPROVED",
      reviewRequestedAt: null,
      reviewedAt: new Date(),
      seasonId: "season-1",
      teamId: "team-1",
      startAt: new Date("2026-09-05T10:00:00.000Z"),
      endAt: null,
      meetingTime: null,
    });
  });

  it("creates a canonical club match with empty opponentName and derives the display name from the club", async () => {
    mocks.externalClubFindFirst.mockResolvedValue({
      id: "club-telegraph",
      name: "FC Telegraph",
      archivedAt: null,
    });

    const res = await POST(
      makeRequest({
        ...MATCH_BODY,
        opponentExternalClubId: "club-telegraph",
        opponentName: null,
      }),
    );

    expect(res.status).toBe(201);
    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.opponentExternalClubId).toBe("club-telegraph");
    expect(call.data.opponentName).toBe("FC Telegraph");
  });

  it("persists an optional Anzeigename override without changing the canonical club id", async () => {
    mocks.externalClubFindFirst.mockResolvedValue({
      id: "club-telegraph",
      name: "FC Telegraph",
      archivedAt: null,
    });

    const res = await POST(
      makeRequest({
        ...MATCH_BODY,
        opponentExternalClubId: "club-telegraph",
        opponentName: "FC Telegraph E1",
      }),
    );

    expect(res.status).toBe(201);
    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.opponentExternalClubId).toBe("club-telegraph");
    expect(call.data.opponentName).toBe("FC Telegraph E1");
  });

  it("still allows manual opponentName-only creation", async () => {
    const res = await POST(
      makeRequest({
        ...MATCH_BODY,
        opponentName: "Freundschaftsgast FC",
      }),
    );

    expect(res.status).toBe(201);
    const call = mocks.eventCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.opponentExternalClubId).toBeNull();
    expect(call.data.opponentName).toBe("Freundschaftsgast FC");
    expect(mocks.externalClubFindFirst).not.toHaveBeenCalled();
  });

  it("rejects when neither canonical club nor manual name is provided", async () => {
    const res = await POST(makeRequest({ ...MATCH_BODY }));
    expect(res.status).toBe(400);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant opponentExternalClubId without leaking tenant ownership", async () => {
    mocks.externalClubFindFirst.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        ...MATCH_BODY,
        opponentExternalClubId: "club-other-tenant",
      }),
    );

    expect(res.status).toBe(404);
    expect(mocks.externalClubFindFirst).toHaveBeenCalledWith({
      where: { id: "club-other-tenant", tenantId: "tenant-1" },
      select: { id: true, name: true, archivedAt: true },
    });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent opponentExternalClubId", async () => {
    mocks.externalClubFindFirst.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        ...MATCH_BODY,
        opponentExternalClubId: "club-missing",
      }),
    );

    expect(res.status).toBe(404);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
