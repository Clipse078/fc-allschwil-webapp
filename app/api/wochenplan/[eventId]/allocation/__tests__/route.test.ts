/**
 * Tests for PATCH /api/wochenplan/[eventId]/allocation
 *
 * MASTERDATA-CONSISTENCY-02 — validates that pitch/dressing-room codes are
 * checked against the canonical, tenant-scoped, active FacilityResource
 * table instead of the static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS
 * registries.
 *
 * Covers:
 * - Authentication / permission enforcement
 * - Tenant isolation: cross-tenant event rejection, tenant identity never
 *   trusted from the client
 * - Accepts a valid, active, tenant-scoped resource code
 * - Rejects an archived resource code
 * - Rejects a resource code belonging to a different tenant
 * - Rejects a pitch code that resolves to a dressing-room resource (and vice versa)
 * - null clears an allocation without requiring DB validation
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdate: vi.fn(),
  facilityResourceFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findUnique: mocks.eventFindUnique,
      update: mocks.eventUpdate,
    },
    facilityResource: {
      findMany: mocks.facilityResourceFindMany,
    },
  },
}));

import { PATCH } from "../route";

const BASE_URL = "http://localhost/api/wochenplan/event-1/allocation";

type RouteContext = { params: Promise<{ eventId: string }> };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(eventId = "event-1"): RouteContext {
  return { params: Promise.resolve({ eventId }) };
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const VALID_SESSION = {
  ok: true,
  status: 200,
  error: null,
  session: { user: { id: "user-1", activeTenantId: TENANT_A } },
};

const TENANT_A_EVENT = { id: "event-1", tenantId: TENANT_A };

const ACTIVE_PITCH = { id: "res-pitch-1", code: "STADION", name: "Stadion", type: "FULL_PITCH" };
const ACTIVE_ROOM = { id: "res-room-1", code: "E1", name: "Garderobe E1", type: "DRESSING_ROOM" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue(VALID_SESSION);
  mocks.eventFindUnique.mockResolvedValue(TENANT_A_EVENT);
  mocks.eventUpdate.mockResolvedValue({
    id: "event-1",
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
  });
  mocks.facilityResourceFindMany.mockResolvedValue([]);
});

describe("PATCH /api/wochenplan/[eventId]/allocation", () => {
  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
      session: null,
    });

    const res = await PATCH(makeRequest({ pitchCode: null }), makeContext());

    expect(res.status).toBe(401);
  });

  it("returns 403 when permission is insufficient", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });

    const res = await PATCH(makeRequest({ pitchCode: null }), makeContext());

    expect(res.status).toBe(403);
  });

  // ── Event existence + tenant isolation ───────────────────────────────────

  it("returns 404 for an unknown eventId", async () => {
    mocks.eventFindUnique.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ pitchCode: null }), makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("returns 403 for an event belonging to a different tenant", async () => {
    mocks.eventFindUnique.mockResolvedValue({ id: "event-1", tenantId: TENANT_B });

    const res = await PATCH(makeRequest({ pitchCode: null }), makeContext());

    expect(res.status).toBe(403);
  });

  it("derives the validation tenant from the event/session — never from the request body", async () => {
    // Body attempts to smuggle a different tenantId; the route has no such
    // field in its contract, so it must be silently ignored.
    mocks.facilityResourceFindMany.mockResolvedValue([ACTIVE_PITCH]);

    await PATCH(
      makeRequest({ pitchCode: "STADION", tenantId: "attacker-tenant" }),
      makeContext(),
    );

    expect(mocks.facilityResourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
  });

  // ── Canonical resource validation: accept ────────────────────────────────

  it("accepts a valid active tenant-scoped pitch resource", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([ACTIVE_PITCH]);

    const res = await PATCH(makeRequest({ pitchCode: "STADION" }), makeContext());

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pitchCode: "STADION" }) }),
    );
  });

  it("accepts a valid active tenant-scoped dressing-room resource", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([ACTIVE_ROOM]);

    const res = await PATCH(
      makeRequest({ homeDressingRoomCode: "E1" }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ homeDressingRoomCode: "E1" }) }),
    );
  });

  it("null clears an allocation without requiring a DB lookup for that field", async () => {
    const res = await PATCH(
      makeRequest({ pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null }),
      makeContext(),
    );

    expect(res.status).toBe(200);
    expect(mocks.facilityResourceFindMany).not.toHaveBeenCalled();
  });

  // ── Canonical resource validation: reject ────────────────────────────────

  it("rejects an archived resource code (excluded by the active-only DB query)", async () => {
    // The archived resource is filtered out at the query level (status: { not: "ARCHIVED" }),
    // so findMany legitimately resolves without it — simulating that here.
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ pitchCode: "STADION" }), makeContext());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Ungültiger pitchCode/);
  });

  it("rejects a resource code belonging to a different tenant", async () => {
    // Cross-tenant codes never appear in the tenant-scoped findMany result.
    mocks.facilityResourceFindMany.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ pitchCode: "STADION" }), makeContext());

    expect(res.status).toBe(400);
  });

  it("rejects a pitch code that resolves to a dressing-room resource", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([ACTIVE_ROOM]);

    const res = await PATCH(makeRequest({ pitchCode: "E1" }), makeContext());

    expect(res.status).toBe(400);
  });

  it("rejects a dressing-room code that resolves to a pitch resource", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([ACTIVE_PITCH]);

    const res = await PATCH(
      makeRequest({ homeDressingRoomCode: "STADION" }),
      makeContext(),
    );

    expect(res.status).toBe(400);
  });

  it("rejects a non-string pitchCode", async () => {
    const res = await PATCH(makeRequest({ pitchCode: 42 }), makeContext());

    expect(res.status).toBe(400);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("persists all three allocation fields together", async () => {
    mocks.facilityResourceFindMany.mockResolvedValue([
      ACTIVE_PITCH,
      ACTIVE_ROOM,
      { id: "res-room-2", code: "E2", name: "Garderobe E2", type: "DRESSING_ROOM" },
    ]);

    await PATCH(
      makeRequest({ pitchCode: "STADION", homeDressingRoomCode: "E1", awayDressingRoomCode: "E2" }),
      makeContext(),
    );

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pitchCode: "STADION", homeDressingRoomCode: "E1", awayDressingRoomCode: "E2" },
      }),
    );
  });
});
