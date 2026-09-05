/**
 * RPERM-05 — Platform isolation for the pre-existing /api/roles endpoints
 *
 * These endpoints predate RPERM-05 and are gated by USERS_MANAGE (a
 * PLATFORM permission), but previously queried ALL Role rows regardless of
 * scope — meaning a tenant-owned role id could be read or mutated through
 * the platform-only surface. This test locks in the RPERM-05 fix: every
 * lookup now filters `scope: "PLATFORM"`, so a tenant role id 404s here
 * exactly like a nonexistent id would.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformApiPermission: vi.fn(),
  role: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { role: mocks.role },
}));

import { GET as listRoles } from "@/app/api/roles/route";
import { PATCH as patchRole } from "@/app/api/roles/[id]/route";

function mockAuthorized() {
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    actorUserId: "platform-admin",
    session: { user: { id: "platform-admin", activeTenantId: null } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/roles — platform scope filter", () => {
  it("queries only scope=PLATFORM roles", async () => {
    mockAuthorized();
    mocks.role.findMany.mockResolvedValue([]);

    await listRoles();

    expect(mocks.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "PLATFORM" } }),
    );
  });
});

describe("PATCH /api/roles/[id] — tenant-owned role id is rejected", () => {
  it("404s a role id belonging to a tenant (findFirst is scoped to PLATFORM)", async () => {
    mockAuthorized();
    // Simulating the DB correctly returning nothing because the role's
    // actual scope is TENANT — the query itself filters scope: "PLATFORM".
    mocks.role.findFirst.mockResolvedValue(null);

    const req = new Request("http://localhost/api/roles/tenant-role-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hijacked" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await patchRole(req as never, { params: Promise.resolve({ id: "tenant-role-1" }) });
    expect(res.status).toBe(404);
    expect(mocks.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tenant-role-1", scope: "PLATFORM" } }),
    );
    expect(mocks.role.update).not.toHaveBeenCalled();
  });
});
