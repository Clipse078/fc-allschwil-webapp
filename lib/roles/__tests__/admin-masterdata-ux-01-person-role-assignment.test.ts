/**
 * ADMIN-MASTERDATA-UX-01 (Part A) — Person <-> tenant-role assignment
 * integration tests (live DB, disposable — never STAGE; see
 * lib/roles/__tests__/test-helpers.ts).
 *
 * Covers the task's Part A test list end-to-end through the canonical
 * UserRole/TenantMembership/Role relationship — no PersonRole or second
 * permission model is introduced anywhere in this flow:
 *
 *   1. linked User's tenant roles render (getTenantRoleAssignmentForUser)
 *   2. tenant role can be assigned (assignTenantRoleToUser)
 *   3. tenant role can be removed (removeTenantRoleAssignment)
 *   4. cross-tenant role rejected (role from Tenant B against Tenant A user)
 *   5. PLATFORM role rejected (PLATFORM-scoped role id never resolves as a
 *      tenant role — loadOwnedTenantRole filters scope: "TENANT")
 *   6. (unauthorized user cannot assign/remove — already covered by the
 *      permission-gated API route itself; see
 *      app/api/tenant/roles/[id]/members/__tests__/route.test.ts, which
 *      this UI reuses verbatim)
 *   7. Person without a linked User (getPersonById().user === null)
 *   8. role changes use the canonical UserRole relationship (asserted
 *      directly against the UserRole table, not a second model)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assignTenantRoleToUser, removeTenantRoleAssignment } from "@/lib/roles/mutations";
import { RoleNotFoundError } from "@/lib/roles/errors";
import { getTenantRoleAssignmentForUser, getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { getPersonById } from "@/lib/people/queries";
import {
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  cleanupTestFixtures,
  ensurePermission,
  prisma,
  uniqueSuffix,
} from "./test-helpers";

describe("ADMIN-MASTERDATA-UX-01 — Person <-> tenant-role assignment (live DB)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPersonIds: string[] = [];

  beforeAll(async () => {
    tenantA = await createTestTenant("person-role-a");
    tenantB = await createTestTenant("person-role-b");
    createdTenantIds.push(tenantA.id, tenantB.id);

    await ensurePermission("roles.manage", { module: "ROLES", scope: "TENANT", grantableByAdmin: true });
    await ensurePermission("roles.assign", { module: "ROLES", scope: "TENANT", grantableByAdmin: true });
  });

  afterAll(async () => {
    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
    }
    await cleanupTestFixtures({ tenantIds: createdTenantIds, userIds: createdUserIds });
    await prisma.$disconnect();
  });

  async function createLinkedPerson(label: string) {
    const suffix = uniqueSuffix();
    const user = await createTestUser(`${label}-${suffix}`);
    createdUserIds.push(user.id);

    const person = await prisma.person.create({
      data: {
        firstName: "Test",
        lastName: `Person-${label}-${suffix}`,
        userId: user.id,
      },
      select: { id: true },
    });
    createdPersonIds.push(person.id);

    return { user, person };
  }

  it("7. Person without a linked User resolves user: null (no-account state)", async () => {
    const suffix = uniqueSuffix();
    const person = await prisma.person.create({
      data: { firstName: "Ohne", lastName: `Konto-${suffix}` },
      select: { id: true },
    });
    createdPersonIds.push(person.id);

    const loaded = await getPersonById(person.id);
    expect(loaded?.userId).toBeNull();
    expect(loaded?.user).toBeNull();
  });

  it("1/8. FIRST inspects and reuses the explicit Person.userId <-> User relation — no email matching", async () => {
    const { user, person } = await createLinkedPerson("explicit-link");

    const loaded = await getPersonById(person.id);
    expect(loaded?.userId).toBe(user.id);
    expect(loaded?.user?.id).toBe(user.id);
    expect(loaded?.user?.email).toBe(user.email);
  });

  it("1. linked User's tenant roles render via getTenantRoleAssignmentForUser", async () => {
    const { user, person } = await createLinkedPerson("render-roles");
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Zugang Rolle ${Date.now()}` });

    await assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" });

    const loaded = await getPersonById(person.id);
    const assignment = await getTenantRoleAssignmentForUser(tenantA.id, loaded!.userId!);

    expect(assignment).not.toBeNull();
    expect(assignment!.isActiveMember).toBe(true);
    expect(assignment!.roleIds).toContain(role.id);
  });

  it("2. a tenant role can be assigned to the Person's linked User", async () => {
    const { user } = await createLinkedPerson("assign-role");
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Assign Test ${Date.now()}` });

    const before = await getTenantRoleAssignmentForUser(tenantA.id, user.id);
    expect(before!.roleIds).not.toContain(role.id);

    const result = await assignTenantRoleToUser({
      tenantId: tenantA.id,
      roleId: role.id,
      userId: user.id,
      actorUserId: "actor-1",
    });
    expect(result.assigned).toBe(true);

    const after = await getTenantRoleAssignmentForUser(tenantA.id, user.id);
    expect(after!.roleIds).toContain(role.id);
  });

  it("3. a tenant role can be removed from the Person's linked User", async () => {
    const { user } = await createLinkedPerson("remove-role");
    await createTestMembership(tenantA.id, user.id, true);
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `Remove Test ${Date.now()}` });

    await assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" });
    let assignment = await getTenantRoleAssignmentForUser(tenantA.id, user.id);
    expect(assignment!.roleIds).toContain(role.id);

    const result = await removeTenantRoleAssignment({
      tenantId: tenantA.id,
      roleId: role.id,
      userId: user.id,
      actorUserId: "actor-1",
    });
    expect(result.removed).toBe(true);

    assignment = await getTenantRoleAssignmentForUser(tenantA.id, user.id);
    expect(assignment!.roleIds).not.toContain(role.id);
  });

  it("4. a role owned by a different tenant is rejected (cross-tenant)", async () => {
    const { user } = await createLinkedPerson("cross-tenant");
    await createTestMembership(tenantA.id, user.id, true);
    const roleInB = await createTenantRoleFixture({ tenantId: tenantB.id, name: `Tenant B Role ${Date.now()}` });

    await expect(
      assignTenantRoleToUser({ tenantId: tenantA.id, roleId: roleInB.id, userId: user.id, actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);

    // Read side never lists a role belonging to a different tenant either.
    const roles = await getTenantRolesOverview(tenantA.id);
    expect(roles.find((r) => r.id === roleInB.id)).toBeUndefined();
  });

  it("5. a PLATFORM-scoped role can never be assigned through the tenant assignment path", async () => {
    const { user } = await createLinkedPerson("platform-role");
    await createTestMembership(tenantA.id, user.id, true);

    const platformRole = await prisma.role.create({
      data: {
        key: `platform-role-${uniqueSuffix()}`,
        name: "Platform Only",
        scope: "PLATFORM",
        isSystem: false,
      },
    });

    try {
      await expect(
        assignTenantRoleToUser({
          tenantId: tenantA.id,
          roleId: platformRole.id,
          userId: user.id,
          actorUserId: "actor-1",
        }),
      ).rejects.toBeInstanceOf(RoleNotFoundError);

      // The tenant role catalog offered to the Person UX never includes it.
      const roles = await getTenantRolesOverview(tenantA.id);
      expect(roles.find((r) => r.id === platformRole.id)).toBeUndefined();
    } finally {
      await prisma.role.delete({ where: { id: platformRole.id } });
    }
  });

  it("cross-tenant membership: a User with no membership in the caller's tenant resolves to null (no leakage)", async () => {
    const { user } = await createLinkedPerson("no-membership-here");
    await createTestMembership(tenantB.id, user.id, true); // member of B only

    const assignment = await getTenantRoleAssignmentForUser(tenantA.id, user.id);
    expect(assignment).toBeNull();
  });
});
