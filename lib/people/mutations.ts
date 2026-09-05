/**
 * lib/people/mutations.ts
 *
 * ADMIN-MASTERDATA-UX-01-C1 — Person <-> User linking.
 *
 * `Person.userId` is the sole, explicit relation (see prisma/schema.prisma
 * — added in ADMIN-MASTERDATA-UX-01). This module is the only place that
 * writes it. It never touches `User.passwordHash`, never creates a
 * `TenantMembership`, and never mutates `UserRole` — linking/unlinking is
 * a pure Person-side pointer change.
 *
 * Eligibility rule (link only — reused verbatim, not a second rule): the
 * target User must have an ACTIVE `TenantMembership` in the caller's
 * active tenant — the exact same eligibility source as tenant role
 * assignment (`getEligibleTenantMembers()` / `assignTenantRoleToUser()`).
 * This is what rejects a cross-tenant User and a PLATFORM-only User with
 * no tenant membership at all.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  PersonAlreadyLinkedError,
  PersonNotFoundError,
  UserAlreadyLinkedError,
  UserNotEligibleError,
} from "@/lib/people/errors";

const AUDIT_MODULE_KEY = "people";

export type LinkPersonToUserInput = {
  personId: string;
  userId: string;
  tenantId: string;
  actorUserId?: string | null;
};

export type LinkPersonToUserResult = { personId: string; userId: string };

/**
 * Links an existing, unlinked Person to an existing, eligible User.
 * Never creates a User, never creates/changes a TenantMembership, never
 * touches credentials. Fails with PersonAlreadyLinkedError if the Person
 * already has a different linked User (unlink first) and with
 * UserAlreadyLinkedError if the User is already linked to a different
 * Person (Person.userId is @unique — at most one Person per User).
 */
export async function linkPersonToUser(input: LinkPersonToUserInput): Promise<LinkPersonToUserResult> {
  const person = await prisma.person.findFirst({
    where: { id: input.personId, tenantId: input.tenantId },
    select: { id: true, userId: true },
  });
  if (!person) throw new PersonNotFoundError();
  if (person.userId) throw new PersonAlreadyLinkedError();

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
    select: {
      isActive: true,
      user: { select: { id: true, isActive: true } },
    },
  });
  if (!membership) {
    throw new UserNotEligibleError();
  }
  if (!membership.isActive || !membership.user.isActive) {
    throw new UserNotEligibleError();
  }

  const alreadyLinkedTo = await prisma.person.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (alreadyLinkedTo) throw new UserAlreadyLinkedError();

  try {
    const updated = await prisma.person.updateMany({
      where: {
        id: input.personId,
        tenantId: input.tenantId,
        userId: null,
      },
      data: { userId: input.userId },
    });
    if (updated.count !== 1) throw new PersonAlreadyLinkedError();

    await logAction({
      actorUserId: input.actorUserId ?? null,
      moduleKey: AUDIT_MODULE_KEY,
      entityType: "Person",
      entityId: person.id,
      action: "LINK_USER",
      afterJson: { personId: person.id, userId: input.userId, tenantId: input.tenantId },
    });

    return { personId: person.id, userId: input.userId };
  } catch (error) {
    // TOCTOU race on the @unique Person.userId constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserAlreadyLinkedError();
    }
    throw error;
  }
}

export type UnlinkPersonFromUserInput = {
  personId: string;
  tenantId: string;
  actorUserId?: string | null;
};

export type UnlinkPersonFromUserResult = { unlinked: boolean };

/**
 * Clears Person.userId only. Idempotent — unlinking an already-unlinked
 * Person is a no-op success. Never deletes/modifies the User row, its
 * TenantMembership, or any UserRole — those are untouched by design.
 */
export async function unlinkPersonFromUser(input: UnlinkPersonFromUserInput): Promise<UnlinkPersonFromUserResult> {
  const person = await prisma.person.findFirst({
    where: { id: input.personId, tenantId: input.tenantId },
    select: { id: true, userId: true },
  });
  if (!person) throw new PersonNotFoundError();
  if (!person.userId) return { unlinked: false };

  const previousUserId = person.userId;

  const updated = await prisma.person.updateMany({
    where: {
      id: input.personId,
      tenantId: input.tenantId,
      userId: previousUserId,
    },
    data: { userId: null },
  });
  if (updated.count !== 1) return { unlinked: false };

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Person",
    entityId: person.id,
    action: "UNLINK_USER",
    beforeJson: { personId: person.id, userId: previousUserId, tenantId: input.tenantId },
  });

  return { unlinked: true };
}
