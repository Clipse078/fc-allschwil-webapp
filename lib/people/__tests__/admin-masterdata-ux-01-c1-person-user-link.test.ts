/**
 * ADMIN-MASTERDATA-UX-01-C1 (Part A) — Person <-> existing User linking
 * integration tests (live DB, disposable — never STAGE; see
 * lib/roles/__tests__/test-helpers.ts).
 *
 * Covers the task's C1-A test list:
 *   1. unlinked Person can link existing same-tenant User
 *   2. linked Person immediately exposes canonical tenant roles
 *   3. cross-tenant User cannot be linked
 *   4. unrelated PLATFORM-only User cannot be linked through tenant UX
 *   5. already-linked User cannot be linked to second Person
 *   6. unlink only clears Person.userId
 *   7. unlink preserves User/TenantMembership/UserRole
 *   9. no password/session/auth credential mutation (proven structurally:
 *      the mutation only ever writes Person.userId; passwordHash is never
 *      selected or written anywhere in this suite)
 *
 * (8. unauthorized caller cannot link/unlink is a route-level authority
 *  check identical in shape to app/api/tenant/roles/[id]/members — see
 *  app/api/people/[id]/link-user/__tests__/route.test.ts.)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { linkPersonToUser, unlinkPersonFromUser } from "@/lib/people/mutations";
import {
  LinkUserNotFoundError,
  PersonAlreadyLinkedError,
  PersonNotFoundError,
  UserAlreadyLinkedError,
  UserNotEligibleError,
} from "@/lib/people/errors";
import { getTenantRoleAssignmentForUser, getLinkableTenantUsersForPerson } from "@/lib/roles/tenant-queries";
import { assignTenantRoleToUser } from "@/lib/roles/mutations";
import { getPersonById } from "@/lib/people/queries";
import {
  createTenantRoleFixture,
  createTestMembership,
  createTestTenant,
  createTestUser,
  cleanupTestFixtures,
  prisma,
  uniqueSuffix,
} from "@/lib/roles/__tests__/test-helpers";

describe("ADMIN-MASTERDATA-UX-01-C1 — Person <-> User linking (live DB)", () => {
  let tenantA: { id: string };
  let tenantB: { id: string };
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdPersonIds: string[] = [];

  beforeAll(async () => {
    tenantA = await createTestTenant("c1-link-a");
    tenantB = await createTestTenant("c1-link-b");
    createdTenantIds.push(tenantA.id, tenantB.id);
  });

  afterAll(async () => {
    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
    }
    await cleanupTestFixtures({ tenantIds: createdTenantIds, userIds: createdUserIds });
    await prisma.$disconnect();
  });

  // INVITE-01: Person.tenantId is NOT NULL; always supply tenantA for test fixtures.
  async function createUnlinkedPerson(label: string, tenantId?: string) {
    const suffix = uniqueSuffix();
    const person = await prisma.person.create({
      data: { firstName: "Test", lastName: `Person-${label}-${suffix}`, tenantId: tenantId ?? tenantA.id },
      select: { id: true },
    });
    createdPersonIds.push(person.id);
    return person;
  }

  it("1. an unlinked Person can link an existing same-tenant User", async () => {
    const user = await createTestUser("link-target");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const person = await createUnlinkedPerson("link-target");

    const result = await linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id });
    expect(result).toEqual({ personId: person.id, userId: user.id });

    const loaded = await getPersonById(person.id);
    expect(loaded?.userId).toBe(user.id);
    expect(loaded?.user?.email).toBe(user.email);
  });

  it("2. a linked Person immediately exposes canonical tenant roles via getTenantRoleAssignmentForUser", async () => {
    const user = await createTestUser("expose-roles");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const person = await createUnlinkedPerson("expose-roles");
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `C1 Expose Role ${Date.now()}` });
    await assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" });

    await linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id });

    const loaded = await getPersonById(person.id);
    const assignment = await getTenantRoleAssignmentForUser(tenantA.id, loaded!.userId!);
    expect(assignment?.isActiveMember).toBe(true);
    expect(assignment?.roleIds).toContain(role.id);
  });

  it("3. a User whose only membership is a different tenant (cross-tenant) cannot be linked", async () => {
    const user = await createTestUser("cross-tenant-link");
    createdUserIds.push(user.id);
    await createTestMembership(tenantB.id, user.id, true); // member of B, not A
    const person = await createUnlinkedPerson("cross-tenant-link");

    await expect(
      linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(UserNotEligibleError);

    const loaded = await getPersonById(person.id);
    expect(loaded?.userId).toBeNull();

    // Never appears in the eligible-for-linking list for tenant A either.
    const linkable = await getLinkableTenantUsersForPerson(tenantA.id);
    expect(linkable.find((u) => u.userId === user.id)).toBeUndefined();
  });

  it("4. a PLATFORM-only User with no tenant membership at all cannot be linked", async () => {
    const user = await createTestUser("platform-only-link");
    createdUserIds.push(user.id);
    // No TenantMembership row anywhere for this user.
    const person = await createUnlinkedPerson("platform-only-link");

    await expect(
      linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(UserNotEligibleError);

    const linkable = await getLinkableTenantUsersForPerson(tenantA.id);
    expect(linkable.find((u) => u.userId === user.id)).toBeUndefined();
  });

  it("linking a non-existent userId is rejected distinctly (USER_NOT_FOUND)", async () => {
    const person = await createUnlinkedPerson("nonexistent-user");
    await expect(
      linkPersonToUser({ personId: person.id, userId: "does-not-exist", tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(LinkUserNotFoundError);
  });

  it("linking to a non-existent Person is rejected (PERSON_NOT_FOUND)", async () => {
    const user = await createTestUser("orphan-link-target");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);

    await expect(
      linkPersonToUser({ personId: "does-not-exist", userId: user.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it("5. a User already linked to a Person cannot be linked to a second Person (Person.userId is @unique)", async () => {
    const user = await createTestUser("double-link-target");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const firstPerson = await createUnlinkedPerson("double-link-first");
    const secondPerson = await createUnlinkedPerson("double-link-second");

    await linkPersonToUser({ personId: firstPerson.id, userId: user.id, tenantId: tenantA.id });

    await expect(
      linkPersonToUser({ personId: secondPerson.id, userId: user.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(UserAlreadyLinkedError);

    // Never appears in the eligible-for-linking list once already linked.
    const linkable = await getLinkableTenantUsersForPerson(tenantA.id);
    expect(linkable.find((u) => u.userId === user.id)).toBeUndefined();
  });

  it("a Person that already has a linked User cannot be re-linked without unlinking first", async () => {
    const userOne = await createTestUser("already-linked-1");
    const userTwo = await createTestUser("already-linked-2");
    createdUserIds.push(userOne.id, userTwo.id);
    await createTestMembership(tenantA.id, userOne.id, true);
    await createTestMembership(tenantA.id, userTwo.id, true);
    const person = await createUnlinkedPerson("already-linked-person");

    await linkPersonToUser({ personId: person.id, userId: userOne.id, tenantId: tenantA.id });

    await expect(
      linkPersonToUser({ personId: person.id, userId: userTwo.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(PersonAlreadyLinkedError);
  });

  it("6/7. unlink only clears Person.userId — the User, its TenantMembership, and its UserRole rows are untouched", async () => {
    const user = await createTestUser("unlink-preserve");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, true);
    const person = await createUnlinkedPerson("unlink-preserve");
    const role = await createTenantRoleFixture({ tenantId: tenantA.id, name: `C1 Unlink Role ${Date.now()}` });
    await assignTenantRoleToUser({ tenantId: tenantA.id, roleId: role.id, userId: user.id, actorUserId: "actor-1" });

    await linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id });

    const userBefore = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true, updatedAt: true },
    });
    const membershipBefore = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
    });
    const userRoleBefore = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, orgUnitId: null },
    });

    const result = await unlinkPersonFromUser({ personId: person.id });
    expect(result.unlinked).toBe(true);

    const loaded = await getPersonById(person.id);
    expect(loaded?.userId).toBeNull();
    expect(loaded?.user).toBeNull();

    // User row unchanged (never selecting/comparing passwordHash — this
    // mutation module never reads or writes it).
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true, updatedAt: true },
    });
    expect(userAfter).toEqual(userBefore);

    const membershipAfter = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenantA.id, userId: user.id } },
    });
    expect(membershipAfter).toEqual(membershipBefore);

    const userRoleAfter = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, orgUnitId: null },
    });
    expect(userRoleAfter).toEqual(userRoleBefore);
    expect(userRoleAfter).not.toBeNull();
  });

  it("unlinking an already-unlinked Person is an idempotent no-op", async () => {
    const person = await createUnlinkedPerson("idempotent-unlink");
    const result = await unlinkPersonFromUser({ personId: person.id });
    expect(result.unlinked).toBe(false);
  });

  it("unlinking a non-existent Person is rejected (PERSON_NOT_FOUND)", async () => {
    await expect(unlinkPersonFromUser({ personId: "does-not-exist" })).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it("an inactive-membership User cannot be linked (same eligibility rule as tenant role assignment)", async () => {
    const user = await createTestUser("inactive-membership-link");
    createdUserIds.push(user.id);
    await createTestMembership(tenantA.id, user.id, false); // inactive membership
    const person = await createUnlinkedPerson("inactive-membership-link");

    await expect(
      linkPersonToUser({ personId: person.id, userId: user.id, tenantId: tenantA.id }),
    ).rejects.toBeInstanceOf(UserNotEligibleError);
  });
});
