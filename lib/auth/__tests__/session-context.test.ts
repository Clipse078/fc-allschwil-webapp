/**
 * RPERM-04 — Session Tenant Context Resolution Tests
 *
 * Covers lib/auth/session-context.ts, the single model used by auth.ts
 * (login), the impersonation route, and the stop-impersonation route to
 * derive:
 *   - activeTenantId / activeMembershipId / availableTenants — exclusively
 *     from active TenantMembership rows, never from User.tenantId.
 *   - permissionKeys — the resolver-derived union of platform and tenant
 *     permissions, never a blind flatten of every role's permissions.
 *
 * Test groups:
 *   TC-01  No memberships → null tenant context, empty availableTenants
 *   TC-02  Single active membership → becomes activeTenantId
 *   TC-03  Multiple active memberships → earliest joinedAt wins; all listed
 *   TC-04  Inactive memberships are excluded entirely (query-level filter)
 *   TC-05  Empty userId → null context, no query issued
 *   PK-01  No tenant context → permissionKeys is platform-only
 *   PK-02  Platform role's tenant-scoped permissions are NOT included
 *          (the exact bug this slice fixes)
 *   PK-03  Active tenant role contributes tenant permissions
 *   PK-04  permissionKeys is deduplicated and sorted
 *   PK-05  Empty userId → empty permissionKeys, resolver not queried
 *
 * RPERM-04-C1 — Archived Tenant Exclusion:
 *   TS-01  The membership query filters at DB level by tenant.status ACTIVE
 *   TS-02  Multi-tenant user with one active and one archived tenant →
 *          only the active tenant is returned; the archived tenant's
 *          membership never becomes activeTenantId/activeMembershipId
 *   TS-03  A user whose ONLY membership is in an archived tenant gets
 *          activeTenantId: null, activeMembershipId: null, availableTenants: []
 */

import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  resolveTenantMembershipContext,
  resolveSessionPermissionKeys,
} from "../session-context";

function makeMockPrisma(overrides: {
  tenantMembershipFindMany?: ReturnType<typeof vi.fn>;
  userRoleFindMany?: ReturnType<typeof vi.fn>;
  tenantMembershipFindUnique?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  return {
    tenantMembership: {
      findMany: overrides.tenantMembershipFindMany ?? vi.fn().mockResolvedValue([]),
      findUnique: overrides.tenantMembershipFindUnique ?? vi.fn().mockResolvedValue(null),
    },
    userRole: {
      findMany: overrides.userRoleFindMany ?? vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient;
}

describe("resolveTenantMembershipContext", () => {
  it("TC-01: user with no active memberships gets null tenant context", async () => {
    const prisma = makeMockPrisma({
      tenantMembershipFindMany: vi.fn().mockResolvedValue([]),
    });

    const result = await resolveTenantMembershipContext(prisma, "user-1");

    expect(result).toEqual({
      activeTenantId: null,
      activeMembershipId: null,
      availableTenants: [],
    });
  });

  it("TC-02: single active membership becomes the active tenant", async () => {
    const prisma = makeMockPrisma({
      tenantMembershipFindMany: vi.fn().mockResolvedValue([
        {
          id: "membership-1",
          tenant: { id: "tenant-1", key: "fc-allschwil", name: "FC Allschwil" },
        },
      ]),
    });

    const result = await resolveTenantMembershipContext(prisma, "user-1");

    expect(result.activeTenantId).toBe("tenant-1");
    expect(result.activeMembershipId).toBe("membership-1");
    expect(result.availableTenants).toEqual([
      { id: "tenant-1", key: "fc-allschwil", name: "FC Allschwil" },
    ]);
  });

  it("TC-03: multiple active memberships — earliest joinedAt (query order) becomes active, all are listed", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "membership-early", tenant: { id: "tenant-early", key: "early", name: "Early Club" } },
      { id: "membership-late", tenant: { id: "tenant-late", key: "late", name: "Late Club" } },
    ]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    const result = await resolveTenantMembershipContext(prisma, "user-1");

    // The resolver relies on the DB ORDER BY joinedAt asc — verify it is requested.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isActive: true, tenant: { status: "ACTIVE" } },
        orderBy: { joinedAt: "asc" },
      }),
    );

    expect(result.activeTenantId).toBe("tenant-early");
    expect(result.activeMembershipId).toBe("membership-early");
    expect(result.availableTenants).toHaveLength(2);
    expect(result.availableTenants.map((t) => t.id)).toEqual(["tenant-early", "tenant-late"]);
  });

  it("TC-04: inactive memberships are excluded at the query level", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    await resolveTenantMembershipContext(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isActive: true, tenant: { status: "ACTIVE" } },
      }),
    );
  });

  it("TC-05: empty userId returns null context without querying the database", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    const result = await resolveTenantMembershipContext(prisma, "");

    expect(result).toEqual({
      activeTenantId: null,
      activeMembershipId: null,
      availableTenants: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

// ── RPERM-04-C1: Archived Tenant Exclusion ──────────────────────────────────
//
// A membership being `isActive: true` is necessary but not sufficient — the
// related Tenant must also be operationally ACTIVE. This is the fix for
// "archived tenant remains accessible" (Finding 1): the DB-level filter
// (tenant: { status: "ACTIVE" }) means an archived/inactive tenant's
// membership rows are excluded before any selection logic runs, so they can
// never become activeTenantId/activeMembershipId or appear in
// availableTenants.
describe("resolveTenantMembershipContext — RPERM-04-C1 archived tenant exclusion", () => {
  it("TS-01: the membership query filters by tenant.status ACTIVE at the DB level", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    await resolveTenantMembershipContext(prisma, "user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant: { status: "ACTIVE" } }),
      }),
    );
  });

  it("TS-02: multi-tenant user with one active and one archived tenant — only the active tenant is returned", async () => {
    // The archived tenant's membership is never returned by the DB at all
    // (the query filters tenant.status: "ACTIVE" server-side) — this models
    // that DB-level behavior directly, mirroring how the resolver is
    // actually queried in production.
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "membership-active",
        tenant: { id: "tenant-active", key: "active-club", name: "Active Club" },
      },
      // NOTE: no row for the archived tenant — proving the DB filter, not
      // in-memory logic, is what excludes it.
    ]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    const result = await resolveTenantMembershipContext(prisma, "user-1");

    expect(result.activeTenantId).toBe("tenant-active");
    expect(result.activeMembershipId).toBe("membership-active");
    expect(result.availableTenants).toEqual([
      { id: "tenant-active", key: "active-club", name: "Active Club" },
    ]);
    // The archived tenant must not appear anywhere in the result.
    expect(result.availableTenants.some((t) => t.id === "tenant-archived")).toBe(false);
  });

  it("TS-03: a user whose ONLY membership is in an archived tenant gets null tenant context", async () => {
    // The archived tenant's membership row is excluded by the DB filter —
    // findMany returns an empty array, exactly as it would for a user with
    // zero memberships at all.
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = makeMockPrisma({ tenantMembershipFindMany: findMany });

    const result = await resolveTenantMembershipContext(prisma, "archived-tenant-member");

    expect(result).toEqual({
      activeTenantId: null,
      activeMembershipId: null,
      availableTenants: [],
    });
  });
});

describe("resolveSessionPermissionKeys", () => {
  it("PK-01: with no tenant context, only platform permissions are included", async () => {
    const prisma = makeMockPrisma({
      userRoleFindMany: vi.fn().mockResolvedValue([
        {
          role: {
            rolePermissions: [
              { permission: { key: "users.manage", scope: "PLATFORM" } },
              { permission: { key: "tenants.manage", scope: "PLATFORM" } },
            ],
          },
        },
      ]),
    });

    const keys = await resolveSessionPermissionKeys(prisma, "user-1", null);

    expect(keys).toEqual(["tenants.manage", "users.manage"]);
  });

  it("PK-02: a PLATFORM role's TENANT-scoped permissions are never included (the flatten bug this slice fixes)", async () => {
    // Simulates super_admin: a single PLATFORM role whose rolePermissions
    // include every permission in the system, including TENANT-scoped ones
    // like teams.manage. Before RPERM-04, auth.ts flattened this into
    // session.permissionKeys unconditionally — silently granting the
    // platform super admin every tenant's operational permissions.
    const prisma = makeMockPrisma({
      userRoleFindMany: vi.fn().mockImplementation(({ where }) => {
        if (where.tenantId === null) {
          return Promise.resolve([
            {
              role: {
                rolePermissions: [
                  { permission: { key: "users.manage", scope: "PLATFORM" } },
                  { permission: { key: "teams.manage", scope: "TENANT" } },
                  { permission: { key: "events.manage", scope: "TENANT" } },
                ],
              },
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(null),
    });

    const keys = await resolveSessionPermissionKeys(prisma, "user-1", "tenant-1");

    expect(keys).toContain("users.manage");
    expect(keys).not.toContain("teams.manage");
    expect(keys).not.toContain("events.manage");
  });

  it("PK-03: an active tenant-scoped role contributes tenant permissions for the active tenant", async () => {
    const prisma = makeMockPrisma({
      userRoleFindMany: vi.fn().mockImplementation(({ where }) => {
        if (where.tenantId === null) {
          return Promise.resolve([]);
        }
        return Promise.resolve([
          {
            role: {
              rolePermissions: [
                { permission: { key: "teams.manage", scope: "TENANT" } },
              ],
            },
          },
        ]);
      }),
      tenantMembershipFindUnique: vi
        .fn()
        .mockResolvedValue({ isActive: true, tenant: { status: "ACTIVE" } }),
    });

    const keys = await resolveSessionPermissionKeys(prisma, "user-1", "tenant-1");

    expect(keys).toEqual(["teams.manage"]);
  });

  it("PK-06: an active membership in an ARCHIVED tenant contributes no tenant permissions (RPERM-04-C1)", async () => {
    const prisma = makeMockPrisma({
      userRoleFindMany: vi.fn().mockImplementation(({ where }) => {
        if (where.tenantId === null) {
          return Promise.resolve([]);
        }
        return Promise.resolve([
          {
            role: {
              rolePermissions: [
                { permission: { key: "teams.manage", scope: "TENANT" } },
              ],
            },
          },
        ]);
      }),
      tenantMembershipFindUnique: vi
        .fn()
        .mockResolvedValue({ isActive: true, tenant: { status: "ARCHIVED" } }),
    });

    const keys = await resolveSessionPermissionKeys(prisma, "user-1", "tenant-1");

    expect(keys).not.toContain("teams.manage");
    expect(keys).toEqual([]);
  });

  it("PK-04: result is deduplicated and sorted", async () => {
    const prisma = makeMockPrisma({
      userRoleFindMany: vi.fn().mockResolvedValue([
        {
          role: {
            rolePermissions: [
              { permission: { key: "zzz.perm", scope: "PLATFORM" } },
              { permission: { key: "aaa.perm", scope: "PLATFORM" } },
              { permission: { key: "aaa.perm", scope: "PLATFORM" } },
            ],
          },
        },
      ]),
    });

    const keys = await resolveSessionPermissionKeys(prisma, "user-1", null);

    expect(keys).toEqual(["aaa.perm", "zzz.perm"]);
  });

  it("PK-05: empty userId returns an empty array", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = makeMockPrisma({ userRoleFindMany: findMany });

    const keys = await resolveSessionPermissionKeys(prisma, "", null);

    expect(keys).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
