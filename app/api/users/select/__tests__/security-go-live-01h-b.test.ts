import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-tenant-context", () => ({
  requireApiTenantPermissionContext: mocks.requireContext,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tenantMembership: { findMany: mocks.membershipFindMany },
  },
}));

import { GET } from "@/app/api/users/select/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireContext.mockResolvedValue({
    ok: true,
    context: { tenantId: "tenant-a", actorUserId: "actor-a" },
  });
});

describe("SECURITY-GO-LIVE-01H-B GET /api/users/select", () => {
  it("6/7. lists only active users eligible through Tenant A membership", async () => {
    mocks.membershipFindMany.mockImplementation(
      async (args: { where: { tenantId: string; isActive: boolean } }) =>
        args.where.tenantId === "tenant-a" && args.where.isActive
          ? [
              {
                user: {
                  id: "user-a",
                  firstName: "Alice",
                  lastName: "A",
                  email: "alice@a.test",
                },
              },
            ]
          : [],
    );

    const response = await GET();

    expect(await response.json()).toEqual([
      { id: "user-a", name: "Alice A", email: "alice@a.test" },
    ]);
    expect(mocks.membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-a",
          isActive: true,
          user: { isActive: true },
        },
      }),
    );
  });

  it("8. returns a global A+B User once based on the A membership", async () => {
    mocks.membershipFindMany.mockResolvedValue([
      {
        user: {
          id: "global-user-ab",
          firstName: "Global",
          lastName: "Member",
          email: "global@example.test",
        },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("global-user-ab");
  });

  it("9. requires the existing users.view/users.manage permission set", async () => {
    mocks.requireContext.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.requireContext).toHaveBeenCalledWith([
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_MANAGE,
    ]);
    expect(mocks.membershipFindMany).not.toHaveBeenCalled();
  });

  it("10. excludes inactive TenantMembership and inactive User rows at query level", async () => {
    mocks.membershipFindMany.mockResolvedValue([]);

    const response = await GET();

    expect(await response.json()).toEqual([]);
    expect(mocks.membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          user: { isActive: true },
        }),
      }),
    );
  });
});
