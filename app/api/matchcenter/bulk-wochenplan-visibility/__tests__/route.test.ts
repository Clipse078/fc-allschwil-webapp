/**
 * PUB-WEEKPLAN-VISIBILITY-01 — Tests for
 * POST /api/matchcenter/bulk-wochenplan-visibility
 *
 * Verification targets:
 *   1. Authorized user can select multiple tenant MATCH events
 *   2. Bulk enable sets only wochenplanVisible=true
 *   3. Bulk disable sets only wochenplanVisible=false
 *   4. IDs belonging to another tenant cannot be mutated (tenant isolation)
 *   5. Non-MATCH events cannot be mutated (type=MATCH guard)
 *   6. websiteVisible remains unchanged (only wochenplanVisible is in data)
 *   7. Season/provider/resource allocation fields remain unchanged
 *   8. Authentication enforcement (401)
 *   9. Permission enforcement (403)
 *  10. Tenant context is required (403 when activeTenantId is null)
 *  11. Empty eventIds rejected (400)
 *  12. Non-string IDs rejected (400)
 *  13. Invalid wochenplanVisible type rejected (400)
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
  eventUpdateMany: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      updateMany: mocks.eventUpdateMany,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST } from "../route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const BASE_URL = "http://localhost/api/matchcenter/bulk-wochenplan-visibility";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeAuthOk(tenantId: string | null = TENANT_A) {
  return {
    ok: true as const,
    status: 200,
    error: null,
    session: { user: { id: "user-1", activeTenantId: tenantId } },
  };
}

function makeAuthFail(status: number, error = "Unauthorized") {
  return { ok: false as const, status, error, session: null };
}

const MATCH_IDS = ["match-1", "match-2", "match-3"];

describe("POST /api/matchcenter/bulk-wochenplan-visibility — authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail(401));

    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(res.status).toBe(401);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when permission is insufficient", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthFail(403, "Forbidden"));

    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(res.status).toBe(403);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when activeTenantId is null (no tenant context)", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(null));

    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Tenant context is required.");
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk());
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("returns 400 when eventIds is missing", async () => {
    const res = await POST(makeRequest({ wochenplanVisible: true }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when eventIds is an empty array", async () => {
    const res = await POST(makeRequest({ eventIds: [], wochenplanVisible: true }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when eventIds contains a non-string value", async () => {
    const res = await POST(makeRequest({ eventIds: ["match-1", 42], wochenplanVisible: true }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when eventIds contains an empty string", async () => {
    const res = await POST(makeRequest({ eventIds: ["match-1", ""], wochenplanVisible: true }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when wochenplanVisible is missing", async () => {
    const res = await POST(makeRequest({ eventIds: MATCH_IDS }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when wochenplanVisible is a string instead of boolean", async () => {
    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: "true" }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 when wochenplanVisible is a number instead of boolean", async () => {
    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: 1 }));
    expect(res.status).toBe(400);
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — bulk enable (wochenplanVisible=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventUpdateMany.mockResolvedValue({ count: 3 });
  });

  it("returns 200 with updated count on success", async () => {
    const res = await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);
  });

  it("sets wochenplanVisible=true in the update data", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { wochenplanVisible: true },
      }),
    );
  });

  it("does NOT set websiteVisible in the update data", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    const call = mocks.eventUpdateMany.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("websiteVisible");
  });

  it("does NOT set seasonId, infoboardVisible, or other fields in the update data", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    const call = mocks.eventUpdateMany.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("seasonId");
    expect(call.data).not.toHaveProperty("infoboardVisible");
    expect(call.data).not.toHaveProperty("homepageVisible");
    expect(call.data).not.toHaveProperty("pitchCode");
    expect(call.data).not.toHaveProperty("teamId");
  });

  it("only wochenplanVisible is present in the update data", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    const call = mocks.eventUpdateMany.mock.calls[0][0];
    expect(Object.keys(call.data)).toEqual(["wochenplanVisible"]);
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — bulk disable (wochenplanVisible=false)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("returns 200 on success", async () => {
    const res = await POST(makeRequest({ eventIds: ["m1", "m2"], wochenplanVisible: false }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(2);
  });

  it("sets wochenplanVisible=false in the update data", async () => {
    await POST(makeRequest({ eventIds: ["m1", "m2"], wochenplanVisible: false }));

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { wochenplanVisible: false },
      }),
    );
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("scopes updateMany to the actor's tenantId", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
  });

  it("includes id-in filter with the provided eventIds", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: MATCH_IDS },
        }),
      }),
    );
  });

  it("cross-tenant IDs are excluded: returns 0 updated when no events match tenant+type", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_B));
    // Simulates: the provided IDs belong to tenant-a, so updateMany for tenant-b returns 0
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      makeRequest({ eventIds: ["tenant-a-match-1", "tenant-a-match-2"], wochenplanVisible: true }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(0);
    // The where clause must include tenant-b, not tenant-a
    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_B }),
      }),
    );
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — MATCH-type guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
  });

  it("restricts updateMany to type=MATCH events only", async () => {
    mocks.eventUpdateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "MATCH" }),
      }),
    );
  });

  it("non-MATCH events are excluded: returns 0 updated when IDs resolve to non-MATCH types", async () => {
    // Simulates: all provided IDs belong to TRAINING events — updateMany with
    // type=MATCH guard produces 0 updates.
    mocks.eventUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      makeRequest({
        eventIds: ["training-1", "training-2"],
        wochenplanVisible: true,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(0);
    // type: "MATCH" must be in the where clause
    expect(mocks.eventUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "MATCH" }),
      }),
    );
  });
});

describe("POST /api/matchcenter/bulk-wochenplan-visibility — revalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(makeAuthOk(TENANT_A));
    mocks.eventUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("revalidates the MatchCenter dashboard path after a successful update", async () => {
    await POST(makeRequest({ eventIds: MATCH_IDS, wochenplanVisible: true }));

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/matchcenter");
  });
});
