/**
 * app/api/wochenplan/[eventId]/allocation/__tests__/route.test.ts
 *
 * MASTERDATA-CONSISTENCY-02 — regression tests for the Wochenplan allocation
 * PATCH route. Submitted codes are now validated against active,
 * tenant-scoped FacilityResource rows (lib/facilities/queries.ts) instead of
 * the static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS registries.
 *
 * Covers:
 *   - valid pitch + dressing-room codes persist successfully
 *   - resource-type semantics: pitchCode must resolve to a PITCH_HALL-group
 *     resource, dressing-room codes must resolve to DRESSING_ROOM
 *   - a code that does not resolve to any active resource is rejected
 *   - an archived resource's code is rejected (excluded by the canonical
 *     query, so it never resolves)
 *   - cross-tenant resource codes are rejected
 *   - tenant isolation for the Event row itself (403 on mismatch)
 *   - permission enforcement (401/403 passthrough)
 *   - null values are always accepted (clearing an allocation)
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpdate: vi.fn(),
  getActiveFacilityResourcesByCodesForTenant: vi.fn(),
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
  },
}));

vi.mock("@/lib/facilities/queries", () => ({
  getActiveFacilityResourcesByCodesForTenant: mocks.getActiveFacilityResourcesByCodesForTenant,
}));

import { PATCH } from "../route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const EVENT_ID = "event-01";

function makeAuthOk(tenantId = TENANT_A) {
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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/wochenplan/${EVENT_ID}/allocation`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function callPatch(body: unknown) {
  return PATCH(makeRequest(body), { params: Promise.resolve({ eventId: EVENT_ID }) });
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    tenantId: TENANT_A,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventFindUnique.mockResolvedValue(makeEvent());
  mocks.eventUpdate.mockResolvedValue({
    id: EVENT_ID,
    pitchCode: null,
    homeDressingRoomCode: null,
    awayDressingRoomCode: null,
  });
  mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());
});

describe("PATCH /api/wochenplan/[eventId]/allocation — permissions", () => {
  it("returns the permission-check status/error when unauthorized", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail(401));

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(401);
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/wochenplan/[eventId]/allocation — event lookup", () => {
  it("returns 404 when the event does not exist", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
    mocks.eventFindUnique.mockResolvedValue(null);

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(404);
  });

  it("returns 403 when the event belongs to a different tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue({ id: EVENT_ID, tenantId: TENANT_B });

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/wochenplan/[eventId]/allocation — null allocations", () => {
  it("accepts all-null allocation without querying canonical resources", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(200);
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pitchCode: null, homeDressingRoomCode: null, awayDressingRoomCode: null },
      }),
    );
  });
});

describe("PATCH /api/wochenplan/[eventId]/allocation — canonical resource validation", () => {
  it("persists a valid pitch + dressing-room allocation resolved via canonical tenant-scoped resources", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([
        ["STADION", { name: "Stadion", type: "FULL_PITCH" }],
        ["E1", { name: "Garderobe E1", type: "DRESSING_ROOM" }],
        ["O1", { name: "Garderobe O1", type: "DRESSING_ROOM" }],
      ]),
    );

    const res = await callPatch({ pitchCode: "STADION", homeDressingRoomCode: "E1", awayDressingRoomCode: "O1" });

    expect(res.status).toBe(200);
    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(
      ["STADION", "E1", "O1"],
      TENANT_A,
    );
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pitchCode: "STADION", homeDressingRoomCode: "E1", awayDressingRoomCode: "O1" },
      }),
    );
  });

  it("accepts a HALF_PITCH-typed pitchCode (preserves the PITCH_HALL group semantics)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["STADION_A", { name: "Stadion A", type: "HALF_PITCH" }]]),
    );

    const res = await callPatch({ pitchCode: "STADION_A", homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(200);
  });

  it("rejects a pitchCode that resolves to a DRESSING_ROOM-typed resource (wrong resource type)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["E1", { name: "Garderobe E1", type: "DRESSING_ROOM" }]]),
    );

    const res = await callPatch({ pitchCode: "E1", homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/pitchCode/);
  });

  it("rejects a homeDressingRoomCode that resolves to a FULL_PITCH-typed resource (wrong resource type)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["STADION", { name: "Stadion", type: "FULL_PITCH" }]]),
    );

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "STADION", awayDressingRoomCode: null });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/homeDressingRoomCode/);
  });

  it("rejects a code that does not resolve to any active resource", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    const res = await callPatch({ pitchCode: "UNKNOWN_CODE", homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Ungültiger pitchCode/);
  });

  it("rejects an archived resource's code (excluded from the canonical active-only query)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    // getActiveFacilityResourcesByCodesForTenant never returns archived
    // resources — simulate that an archived code resolves to nothing.
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "ARCHIVED_ROOM", awayDressingRoomCode: null });

    expect(res.status).toBe(400);
  });

  it("rejects a cross-tenant resource code even if it would be valid for another tenant", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    // Tenant-scoped lookup never returns a tenant-B-only code when queried for tenant A.
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "TENANT_B_ONLY_ROOM", awayDressingRoomCode: null });

    expect(res.status).toBe(400);
    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(
      ["TENANT_B_ONLY_ROOM"],
      TENANT_A,
    );
  });

  it("derives the tenant used for validation from the trusted Event row, not from client input", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue({ id: EVENT_ID, tenantId: TENANT_A });
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["E1", { name: "Garderobe E1", type: "DRESSING_ROOM" }]]),
    );

    // Body has no tenantId field at all — it must be impossible to influence
    // tenant scoping via the request body.
    await callPatch({ pitchCode: null, homeDressingRoomCode: "E1", awayDressingRoomCode: null, tenantId: TENANT_B });

    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(["E1"], TENANT_A);
  });

  it("rejects a non-string pitchCode value", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));

    const res = await callPatch({ pitchCode: 123, homeDressingRoomCode: null, awayDressingRoomCode: null });

    expect(res.status).toBe(400);
  });
});

// ── MASTERDATA-CONSISTENCY-02-C2 — unchanged historical-code write semantics ──

describe("PATCH /api/wochenplan/[eventId]/allocation — unchanged historical archived code", () => {
  it("allows an unchanged historical archived code to survive an update to a different field", async () => {
    // Existing event: homeRoom = archived E9, awayRoom = active E2.
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(
      makeEvent({ homeDressingRoomCode: "E9", awayDressingRoomCode: "E2" }),
    );
    // E9 is archived — never resolved by the active-only query. Only the
    // CHANGED code (E3) needs to resolve.
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["E3", { name: "Garderobe E3", type: "DRESSING_ROOM" }]]),
    );

    // User changes awayRoom E2 -> E3, homeRoom is resent unchanged as "E9".
    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "E9", awayDressingRoomCode: "E3" });

    expect(res.status).toBe(200);
    // Only the genuinely changed code is looked up — not the unchanged one.
    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(["E3"], TENANT_A);
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pitchCode: null, homeDressingRoomCode: "E9", awayDressingRoomCode: "E3" },
      }),
    );
  });

  it("rejects newly assigning an archived code even when another field's historical archived code is unchanged", async () => {
    // Existing event: homeRoom = archived E9, awayRoom = active E2.
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(
      makeEvent({ homeDressingRoomCode: "E9", awayDressingRoomCode: "E2" }),
    );
    // Neither the unchanged E9 nor the newly-attempted archived E8 resolve
    // via the active-only query.
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    // User tries to change homeRoom from archived E9 to a DIFFERENT archived code E8.
    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "E8", awayDressingRoomCode: "E2" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/homeDressingRoomCode/);
    // The update must never have been persisted.
    expect(mocks.eventUpdate).not.toHaveBeenCalled();
  });

  it("an unchanged historical archived pitchCode survives while a room field is updated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(
      makeEvent({ pitchCode: "ARCHIVED_PITCH", homeDressingRoomCode: null, awayDressingRoomCode: null }),
    );
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["E1", { name: "Garderobe E1", type: "DRESSING_ROOM" }]]),
    );

    const res = await callPatch({
      pitchCode: "ARCHIVED_PITCH",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: null,
    });

    expect(res.status).toBe(200);
    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(["E1"], TENANT_A);
  });

  it("still rejects a brand-new archived code when there is no prior value at all", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(makeEvent());
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "E9", awayDressingRoomCode: null });

    expect(res.status).toBe(400);
  });

  it("a genuinely active new assignment still succeeds", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(makeEvent());
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(
      new Map([["E1", { name: "Garderobe E1", type: "DRESSING_ROOM" }]]),
    );

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "E1", awayDressingRoomCode: null });

    expect(res.status).toBe(200);
  });

  it("cross-tenant validation remains rejected even for a resent value that differs from the current one", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventFindUnique.mockResolvedValue(makeEvent({ homeDressingRoomCode: "E1" }));
    // Tenant-scoped lookup never returns a tenant-B-only code when queried for tenant A.
    mocks.getActiveFacilityResourcesByCodesForTenant.mockResolvedValue(new Map());

    const res = await callPatch({ pitchCode: null, homeDressingRoomCode: "TENANT_B_ONLY_ROOM", awayDressingRoomCode: null });

    expect(res.status).toBe(400);
    expect(mocks.getActiveFacilityResourcesByCodesForTenant).toHaveBeenCalledWith(
      ["TENANT_B_ONLY_ROOM"],
      TENANT_A,
    );
  });
});
