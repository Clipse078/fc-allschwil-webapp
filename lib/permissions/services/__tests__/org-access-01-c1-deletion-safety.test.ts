/**
 * ORG-ACCESS-01-C1 — Post-Merge Scoped Assignment Deletion Safety
 *
 * Tests that verify:
 *
 * DS-01  Deleting a scoped OrgUnit cannot produce tenant-wide permission
 *        (orgUnitId=null + scopeMode!=null must never grant access)
 * DS-02  A scoped assignment is removed/invalidated when its OrgUnit is deleted
 *        (Cascade FK: resolver sees no rows → denies)
 * DS-03  Tenant-wide assignments survive unrelated OrgUnit deletion unaffected
 * DS-04  A malformed row (orgUnitId=null, scopeMode set) cannot grant tenant-wide
 *        access via EffectivePermissionResolver
 * DS-05  A malformed row (orgUnitId=null, scopeMode set) cannot grant OrgUnit-scoped
 *        access via OrgUnitPermissionResolver
 * DS-06  Normal exact-scope (THIS_ORG_UNIT) still works after fix
 * DS-07  Normal descendant-scope (THIS_ORG_UNIT_AND_DESCENDANTS) still works after fix
 * DS-08  EffectivePermissionResolver.hasPermission queries with scopeMode: null
 *        (defense-in-depth filter is present in the DB query)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { OrgUnitPermissionResolver } from "../org-unit-permission-resolver";
import { EffectivePermissionResolver } from "../effective-permission-resolver";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  userRole: { findMany: MockFn };
  tenantMembership: { findUnique: MockFn };
  orgUnit: { findUnique: MockFn };
}

function makeMockPrisma(overrides: {
  userRoleFindMany?: MockFn;
  tenantMembershipFindUnique?: MockFn;
  orgUnitFindUnique?: MockFn;
}): PrismaClient {
  return {
    userRole: {
      findMany: overrides.userRoleFindMany ?? vi.fn().mockResolvedValue([]),
    },
    tenantMembership: {
      findUnique:
        overrides.tenantMembershipFindUnique ??
        vi.fn().mockResolvedValue(null),
    },
    orgUnit: {
      findUnique:
        overrides.orgUnitFindUnique ?? vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function activeMembership() {
  return { isActive: true, tenant: { status: "ACTIVE" as const } };
}

function makeOrgUnit(
  id: string,
  tenantId: string,
  parentChain: string[] = [],
) {
  const parent = parentChain[0]
    ? {
        id: parentChain[0],
        parentId: parentChain[1] ?? null,
        parent: parentChain[1]
          ? { id: parentChain[1], parentId: null }
          : null,
      }
    : null;
  return { id, tenantId, parentId: parent?.id ?? null, parent };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = "user-ds-1";
const TENANT_ID = "tenant-ds-1";
const PERM = "trainings.manage";

const ORG_A = "org-a";
const ORG_B = "org-b";
const ORG_A_CHILD = "org-a-child";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ORG-ACCESS-01-C1 Deletion Safety", () => {
  // ── DS-01 ─────────────────────────────────────────────────────────────────
  it("DS-01: malformed row (orgUnitId=null, scopeMode=THIS_ORG_UNIT) does NOT grant OrgUnit-scoped access", async () => {
    // Simulates what SET NULL cascade would have produced: orgUnitId cleared
    // but scopeMode left set. The Cascade FK prevents this in practice, but
    // the resolver must not grant access even if such a row exists.
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        // malformed: orgUnitId null but scopeMode still set
        { orgUnitId: null, scopeMode: "THIS_ORG_UNIT" },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A, TENANT_ID)),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);
    const result = await resolver.hasPermissionInOrgUnit({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
      orgUnitId: ORG_A,
    });

    // Must NOT be granted — malformed row cannot produce tenant-wide grant
    expect(result).toBe(false);
  });

  // ── DS-01b ────────────────────────────────────────────────────────────────
  it("DS-01b: malformed row (orgUnitId=null, scopeMode=THIS_ORG_UNIT_AND_DESCENDANTS) does NOT grant access", async () => {
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        { orgUnitId: null, scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS" },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A, TENANT_ID)),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);
    const result = await resolver.hasPermissionInOrgUnit({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
      orgUnitId: ORG_A,
    });

    expect(result).toBe(false);
  });

  // ── DS-02 ─────────────────────────────────────────────────────────────────
  it("DS-02: after OrgUnit deletion (Cascade), resolver sees no scoped rows → denies", async () => {
    // Post-Cascade: the scoped UserRole row is gone; findMany returns []
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([]), // row cascaded away
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A, TENANT_ID)),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);
    const result = await resolver.hasPermissionInOrgUnit({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
      orgUnitId: ORG_A,
    });

    expect(result).toBe(false);
  });

  // ── DS-03 ─────────────────────────────────────────────────────────────────
  it("DS-03: tenant-wide assignment (orgUnitId=null, scopeMode=null) survives unrelated OrgUnit deletion", async () => {
    // Tenant-wide rows have orgUnitId=null; they are not FK-linked to any OrgUnit
    // and are therefore unaffected by any OrgUnit delete (Cascade or otherwise).
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        // genuine tenant-wide row — untouched by OrgUnit deletion
        { orgUnitId: null, scopeMode: null },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_B, TENANT_ID)),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);
    // Tenant-wide assignment covers any OrgUnit — checking ORG_B (a different unit)
    const result = await resolver.hasPermissionInOrgUnit({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
      orgUnitId: ORG_B,
    });

    expect(result).toBe(true);
  });

  // ── DS-04 ─────────────────────────────────────────────────────────────────
  it("DS-04: malformed row cannot grant tenant-wide access via EffectivePermissionResolver", async () => {
    // The effective resolver must filter scopeMode: null so malformed rows
    // (orgUnitId=null, scopeMode set) are excluded from tenant-wide resolution.
    // Simulated: findMany receives the scopeMode:null filter and returns [] even
    // though a malformed row might exist without that filter.
    const userRoleFindMany = vi
      .fn()
      .mockResolvedValue([]); // filtered to empty by scopeMode: null
    const tenantMembershipFindUnique = vi
      .fn()
      .mockResolvedValue(activeMembership());

    const prisma = {
      userRole: { findMany: userRoleFindMany },
      tenantMembership: { findUnique: tenantMembershipFindUnique },
    } as unknown as PrismaClient;

    const resolver = new EffectivePermissionResolver(prisma);
    const result = await resolver.hasPermission({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
    });

    // Verify: result is false (no tenant-wide grant)
    expect(result).toBe(false);

    // Verify: the query explicitly filters both orgUnitId: null AND scopeMode: null
    expect(userRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgUnitId: null,
          scopeMode: null,
        }),
      }),
    );
  });

  // ── DS-05 ─────────────────────────────────────────────────────────────────
  it("DS-05: mixed bag — malformed row + scoped row; only valid scoped row counts", async () => {
    // One malformed row (would have been the deleted OrgUnit's scoped row under
    // SET NULL — prevented by Cascade, but tested defensively), plus a valid
    // scoped row for a different OrgUnit. The malformed row must not grant
    // access to ORG_B; the valid scoped row grants access to ORG_B.
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        { orgUnitId: null, scopeMode: "THIS_ORG_UNIT" }, // malformed — must be ignored
        { orgUnitId: ORG_B, scopeMode: "THIS_ORG_UNIT" }, // valid scoped row
      ]),
      orgUnitFindUnique: vi.fn().mockImplementation((args: { where: { id: string } }) => {
        const id = args.where.id;
        if (id === ORG_B) return Promise.resolve(makeOrgUnit(ORG_B, TENANT_ID));
        if (id === ORG_A) return Promise.resolve(makeOrgUnit(ORG_A, TENANT_ID));
        return Promise.resolve(null);
      }),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);

    // ORG_B: valid scoped row grants → YES
    await expect(
      resolver.hasPermissionInOrgUnit({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
        orgUnitId: ORG_B,
      }),
    ).resolves.toBe(true);

    // ORG_A: malformed row must not grant; no valid scoped row for ORG_A → NO
    await expect(
      resolver.hasPermissionInOrgUnit({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
        orgUnitId: ORG_A,
      }),
    ).resolves.toBe(false);
  });

  // ── DS-06 ─────────────────────────────────────────────────────────────────
  it("DS-06: normal THIS_ORG_UNIT scope still works (regression guard)", async () => {
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        { orgUnitId: ORG_A, scopeMode: "THIS_ORG_UNIT" },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A, TENANT_ID)),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);

    await expect(
      resolver.hasPermissionInOrgUnit({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
        orgUnitId: ORG_A,
      }),
    ).resolves.toBe(true);

    // Child should NOT be granted by THIS_ORG_UNIT on parent
    const prismaChild = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        { orgUnitId: ORG_A, scopeMode: "THIS_ORG_UNIT" },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A_CHILD, TENANT_ID, [ORG_A])),
    });
    const resolverChild = new OrgUnitPermissionResolver(prismaChild);
    await expect(
      resolverChild.hasPermissionInOrgUnit({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
        orgUnitId: ORG_A_CHILD,
      }),
    ).resolves.toBe(false);
  });

  // ── DS-07 ─────────────────────────────────────────────────────────────────
  it("DS-07: normal THIS_ORG_UNIT_AND_DESCENDANTS scope still works (regression guard)", async () => {
    const prisma = makeMockPrisma({
      tenantMembershipFindUnique: vi.fn().mockResolvedValue(activeMembership()),
      userRoleFindMany: vi.fn().mockResolvedValue([
        { orgUnitId: ORG_A, scopeMode: "THIS_ORG_UNIT_AND_DESCENDANTS" },
      ]),
      orgUnitFindUnique: vi
        .fn()
        .mockResolvedValue(makeOrgUnit(ORG_A_CHILD, TENANT_ID, [ORG_A])),
    });

    const resolver = new OrgUnitPermissionResolver(prisma);

    // Child of ORG_A should be covered
    await expect(
      resolver.hasPermissionInOrgUnit({
        userId: USER_ID,
        permission: PERM,
        tenantId: TENANT_ID,
        orgUnitId: ORG_A_CHILD,
      }),
    ).resolves.toBe(true);
  });

  // ── DS-08 ─────────────────────────────────────────────────────────────────
  it("DS-08: EffectivePermissionResolver.hasPermission query includes scopeMode: null filter", async () => {
    const userRoleFindMany = vi.fn().mockResolvedValue([]);
    const tenantMembershipFindUnique = vi
      .fn()
      .mockResolvedValue(activeMembership());

    const prisma = {
      userRole: { findMany: userRoleFindMany },
      tenantMembership: { findUnique: tenantMembershipFindUnique },
    } as unknown as PrismaClient;

    const resolver = new EffectivePermissionResolver(prisma);
    await resolver.hasPermission({
      userId: USER_ID,
      permission: PERM,
      tenantId: TENANT_ID,
    });

    expect(userRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgUnitId: null,
          scopeMode: null,
        }),
      }),
    );
  });
});
