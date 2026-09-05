import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  requirePlatformApiPermission: vi.fn(),
  auditLogFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: mocks.requireApiPermission,
}));
vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { findMany: mocks.auditLogFindMany } },
}));

import { GET } from "@/app/api/audit-logs/route";

function request(query = "") {
  return new NextRequest(`http://localhost/api/audit-logs${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: "tenant-admin",
        effectiveUserId: "tenant-admin",
        activeTenantId: "tenant-a",
      },
    },
  });
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    actorUserId: "platform-admin",
    session: { user: { id: "platform-admin", activeTenantId: null } },
  });
  mocks.auditLogFindMany.mockResolvedValue([]);
});

describe("GET /api/audit-logs tenant isolation", () => {
  it("always scopes tenant administrators to their active tenant", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-a" } }),
    );
  });

  it("does not accept a caller-supplied tenant id", async () => {
    const response = await GET(request("?tenantId=tenant-b"));

    expect(response.status).toBe(200);
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-a" } }),
    );
  });

  it("keeps platform audit records behind the platform-only guard", async () => {
    const response = await GET(request("?scope=platform"));

    expect(response.status).toBe(200);
    expect(mocks.requirePlatformApiPermission).toHaveBeenCalled();
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: null } }),
    );
  });

  it("denies tenant admins requesting platform audit scope", async () => {
    mocks.requirePlatformApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      actorUserId: null,
      session: { user: { id: "tenant-admin", activeTenantId: "tenant-a" } },
    });

    const response = await GET(request("?scope=platform"));

    expect(response.status).toBe(403);
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });
});
