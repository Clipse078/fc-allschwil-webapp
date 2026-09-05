import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireContext: vi.fn(),
  orgUnitFindFirst: vi.fn(),
  tenantMembershipFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  membershipCreate: vi.fn(),
  membershipFindMany: vi.fn(),
  roleFindUnique: vi.fn(),
  seasonFindUnique: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-tenant-context", () => ({
  requireApiTenantPermissionContext: mocks.requireContext,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    orgUnit: { findFirst: mocks.orgUnitFindFirst },
    tenantMembership: { findFirst: mocks.tenantMembershipFindFirst },
    person: { findFirst: mocks.personFindFirst },
    orgUnitMembership: {
      create: mocks.membershipCreate,
      findMany: mocks.membershipFindMany,
    },
    role: { findUnique: mocks.roleFindUnique },
    season: { findUnique: mocks.seasonFindUnique },
  },
}));

import { POST } from "@/app/api/org-units/[id]/memberships/route";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/org-units/org-a/memberships", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id = "org-a") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireContext.mockResolvedValue({
    ok: true,
    context: { tenantId: "tenant-a", actorUserId: "actor-a" },
  });
  mocks.orgUnitFindFirst.mockImplementation(
    async (args: { where: { id: string; tenantId: string } }) =>
      args.where.id === "org-a" && args.where.tenantId === "tenant-a"
        ? { id: "org-a", tenantId: "tenant-a" }
        : null,
  );
  mocks.tenantMembershipFindFirst.mockResolvedValue({ userId: "user-a" });
  mocks.personFindFirst.mockResolvedValue({ id: "person-a", userId: null });
  mocks.membershipCreate.mockImplementation(async ({ data }) => ({
    id: "membership-new",
    ...data,
  }));
});

describe("SECURITY-GO-LIVE-01H-B POST /api/org-units/[id]/memberships", () => {
  it("18. creates a Tenant A OrgUnit membership for an active Tenant A User", async () => {
    const response = await POST(request({ userId: "user-a" }), context());

    expect(response.status).toBe(201);
    expect(mocks.tenantMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        userId: "user-a",
        isActive: true,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    expect(mocks.membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-a",
          orgUnitId: "org-a",
          userId: "user-a",
          personId: null,
        }),
      }),
    );
  });

  it("18. creates a Tenant A OrgUnit membership for a Tenant A Person", async () => {
    const response = await POST(request({ personId: "person-a" }), context());

    expect(response.status).toBe(201);
    expect(mocks.personFindFirst).toHaveBeenCalledWith({
      where: { id: "person-a", tenantId: "tenant-a" },
      select: { id: true, userId: true },
    });
  });

  it("19/23. rejects a Tenant B-only, inactive, or missing User identically", async () => {
    mocks.tenantMembershipFindFirst.mockResolvedValue(null);

    const response = await POST(request({ userId: "user-b" }), context());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Mitglied nicht gefunden." });
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("20. rejects a Tenant B Person", async () => {
    mocks.personFindFirst.mockResolvedValue(null);

    const response = await POST(request({ personId: "person-b" }), context());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Mitglied nicht gefunden." });
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("21. rejects a Tenant B OrgUnit before identity lookups", async () => {
    const response = await POST(request({ userId: "user-a" }), context("org-b"));

    expect(response.status).toBe(404);
    expect(mocks.tenantMembershipFindFirst).not.toHaveBeenCalled();
    expect(mocks.personFindFirst).not.toHaveBeenCalled();
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("22. rejects a mixed User/Person pair unless the Person links to that User", async () => {
    mocks.personFindFirst.mockResolvedValue({ id: "person-a", userId: "different-user" });

    const response = await POST(
      request({ userId: "user-a", personId: "person-a" }),
      context(),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Mitglied nicht gefunden." });
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it("allows a mutually valid linked User/Person pair in Tenant A", async () => {
    mocks.personFindFirst.mockResolvedValue({ id: "person-a", userId: "user-a" });

    const response = await POST(
      request({ userId: "user-a", personId: "person-a" }),
      context(),
    );

    expect(response.status).toBe(201);
  });
});
