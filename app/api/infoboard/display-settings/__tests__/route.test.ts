/**
 * app/api/infoboard/display-settings/__tests__/route.test.ts
 *
 * INFOBOARD-INTEGRATION-01B — focused tests for the Infoboard display-theme
 * persistence API.
 *
 * Verifies:
 *   - GET returns the resolved theme (default DARK when unset)
 *   - PATCH persists a valid theme and returns it
 *   - PATCH rejects invalid theme values
 *   - Permission gate (INFOBOARD_MANAGE / EVENTS_PUBLISH_INFOBOARD)
 *   - Tenant isolation: always scoped to session.activeTenantId, never a
 *     client-supplied tenantId
 *   - No planning/allocation data is ever read or written by this route
 */

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireApiAnyPermission: vi.fn(),
  tenantFindUnique: vi.fn(),
  tenantUpdate: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: mocks.tenantFindUnique,
      update: mocks.tenantUpdate,
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/infoboard/display-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const OK_ACCESS = {
  ok: true as const,
  status: 200,
  error: null,
  session: { user: { activeTenantId: "tenant-fca", id: "user-1" } },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/infoboard/display-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(OK_ACCESS);
  });

  it("returns 403 when permission check fails", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the resolved theme for the session tenant", async () => {
    mocks.tenantFindUnique.mockResolvedValue({ infoboardDisplayTheme: "LIGHT" });
    const { GET } = await import("../route");
    const res = await GET();
    const json = await res.json();
    expect(json.theme).toBe("LIGHT");
  });

  it("defaults to DARK when the persisted value is null", async () => {
    mocks.tenantFindUnique.mockResolvedValue({ infoboardDisplayTheme: null });
    const { GET } = await import("../route");
    const res = await GET();
    const json = await res.json();
    expect(json.theme).toBe("DARK");
  });

  it("scopes the tenant lookup to session.activeTenantId", async () => {
    mocks.tenantFindUnique.mockResolvedValue({ infoboardDisplayTheme: null });
    const { GET } = await import("../route");
    await GET();
    expect(mocks.tenantFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tenant-fca" } }),
    );
  });

  it("returns 404 when the tenant cannot be found", async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("only selects infoboardDisplayTheme — no planning/allocation fields", async () => {
    mocks.tenantFindUnique.mockResolvedValue({ infoboardDisplayTheme: null });
    const { GET } = await import("../route");
    await GET();
    const call = mocks.tenantFindUnique.mock.calls[0][0];
    expect(call.select).toEqual({ infoboardDisplayTheme: true });
  });
});

describe("PATCH /api/infoboard/display-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiAnyPermission.mockResolvedValue(OK_ACCESS);
  });

  it("returns 403 when permission check fails", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: null,
    });
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ theme: "LIGHT" }));
    expect(res.status).toBe(403);
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });

  it("persists a valid 'LIGHT' theme", async () => {
    mocks.tenantUpdate.mockResolvedValue({ infoboardDisplayTheme: "LIGHT" });
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ theme: "LIGHT" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.theme).toBe("LIGHT");
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-fca" },
        data: { infoboardDisplayTheme: "LIGHT" },
      }),
    );
  });

  it("persists a valid 'DARK' theme", async () => {
    mocks.tenantUpdate.mockResolvedValue({ infoboardDisplayTheme: "DARK" });
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ theme: "DARK" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.theme).toBe("DARK");
  });

  it("normalizes a lowercase theme value before persisting", async () => {
    mocks.tenantUpdate.mockResolvedValue({ infoboardDisplayTheme: "LIGHT" });
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ theme: "light" }));
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { infoboardDisplayTheme: "LIGHT" } }),
    );
  });

  it("rejects an invalid theme value with 400", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ theme: "NEON" }));
    expect(res.status).toBe(400);
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });

  it("rejects a missing theme value with 400", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mocks.tenantUpdate).not.toHaveBeenCalled();
  });

  it("scopes the update to session.activeTenantId, never a client-supplied tenantId", async () => {
    mocks.tenantUpdate.mockResolvedValue({ infoboardDisplayTheme: "LIGHT" });
    const { PATCH } = await import("../route");
    // Even if the client tries to smuggle a different tenantId in the body,
    // the route never reads it — only session.activeTenantId is used.
    await PATCH(makeRequest({ theme: "LIGHT", tenantId: "tenant-other" }));
    expect(mocks.tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tenant-fca" } }),
    );
  });

  it("only writes infoboardDisplayTheme — no planning/allocation fields", async () => {
    mocks.tenantUpdate.mockResolvedValue({ infoboardDisplayTheme: "LIGHT" });
    const { PATCH } = await import("../route");
    await PATCH(makeRequest({ theme: "LIGHT" }));
    const call = mocks.tenantUpdate.mock.calls[0][0];
    expect(Object.keys(call.data)).toEqual(["infoboardDisplayTheme"]);
  });
});
