import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformApiPermission: vi.fn(),
  requireApiAnyPermission: vi.fn(),
  tenantFindUnique: vi.fn(),
  applyTenantLifecycleTransition: vi.fn(),
  getTenants: vi.fn(),
}));

vi.mock("@/lib/permissions/require-platform-api-permission", () => ({
  requirePlatformApiPermission: mocks.requirePlatformApiPermission,
}));
vi.mock("@/lib/permissions/require-api-any-permission", () => ({
  requireApiAnyPermission: mocks.requireApiAnyPermission,
}));
vi.mock("@/lib/tenants/platform-ops/lifecycle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenants/platform-ops/lifecycle")>(
    "@/lib/tenants/platform-ops/lifecycle",
  );
  return {
    ...actual,
    applyTenantLifecycleTransition: mocks.applyTenantLifecycleTransition,
  };
});
vi.mock("@/lib/tenants/queries", () => ({
  getTenants: mocks.getTenants,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: (...args: unknown[]) => mocks.tenantFindUnique(...args),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        tenant: {
          create: vi.fn().mockResolvedValue({
            id: "tenant-1",
            key: "fc-test",
            name: "FC Test",
            status: "ACTIVE",
          }),
        },
        auditLog: { create: vi.fn() },
      }),
    ),
  },
}));

import { GET, POST } from "@/app/api/tenants/route";
import { POST as POST_LIFECYCLE } from "@/app/api/tenants/[tenantSlug]/lifecycle/route";

const TENANT = {
  id: "tenant-1",
  key: "fc-test",
  name: "FC Test",
  status: "ACTIVE" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireApiAnyPermission.mockResolvedValue({ ok: true });
  mocks.requirePlatformApiPermission.mockResolvedValue({
    ok: true,
    actorUserId: "platform-actor",
  });
  mocks.getTenants.mockResolvedValue([TENANT]);
  mocks.tenantFindUnique.mockResolvedValue(TENANT);
});

describe("tenant platform authorization", () => {
  it("allows platform superadmin to view tenant registry", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mocks.getTenants).toHaveBeenCalled();
  });

  it("blocks tenant registry for unauthorized callers", async () => {
    mocks.requireApiAnyPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("blocks impersonated identity from lifecycle mutations", async () => {
    mocks.requirePlatformApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });

    const res = await POST_LIFECYCLE(
      new NextRequest("http://localhost/api/tenants/fc-test/lifecycle", {
        method: "POST",
        body: JSON.stringify({ action: "suspend", reason: "test" }),
      }),
      { params: Promise.resolve({ tenantSlug: "fc-test" }) },
    );

    expect(res.status).toBe(403);
    expect(mocks.applyTenantLifecycleTransition).not.toHaveBeenCalled();
  });

  it("allows platform actor to suspend tenant with audit-backed service", async () => {
    mocks.applyTenantLifecycleTransition.mockResolvedValue({
      tenant: { ...TENANT, status: "INACTIVE" },
      previousStatus: "ACTIVE",
      newStatus: "INACTIVE",
      action: "suspend",
    });

    const res = await POST_LIFECYCLE(
      new NextRequest("http://localhost/api/tenants/fc-test/lifecycle", {
        method: "POST",
        body: JSON.stringify({ action: "suspend", reason: "Policy violation" }),
      }),
      { params: Promise.resolve({ tenantSlug: "fc-test" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.applyTenantLifecycleTransition).toHaveBeenCalledWith(
      expect.anything(),
      TENANT,
      "suspend",
      expect.objectContaining({
        actorUserId: "platform-actor",
        reason: "Policy violation",
      }),
    );
  });

  it("blocks tenant creation for non-platform callers", async () => {
    mocks.requirePlatformApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/tenants", {
        method: "POST",
        body: JSON.stringify({ name: "New Club", key: "new-club" }),
      }),
    );

    expect(res.status).toBe(403);
  });
});
