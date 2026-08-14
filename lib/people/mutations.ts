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
  LinkUserNotFoundError,
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
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
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
    // Distinguish "user doesn't exist at all" from "not eligible for this tenant"
    // only for a clearer error — the mutation guard is the same either way.
    const userExists = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!userExists) throw new LinkUserNotFoundError();
    throw new UserNotEligibleError();
  }
  if (!membership.isActive || !membership.user.isActive) {
    throw new UserNotEligibleError();
  }

  // INVITE-01: userId is now per-tenant unique (@@unique([tenantId, userId])),
  // not globally unique. Check within this tenant only.
  const alreadyLinkedTo = await prisma.person.findFirst({
    where: { userId: input.userId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (alreadyLinkedTo) throw new UserAlreadyLinkedError();

  try {
    const updated = await prisma.person.update({
      where: { id: input.personId },
      data: { userId: input.userId },
      select: { id: true, userId: true },
    });

    await logAction({
      actorUserId: input.actorUserId ?? null,
      moduleKey: AUDIT_MODULE_KEY,
      entityType: "Person",
      entityId: updated.id,
      action: "LINK_USER",
      afterJson: { personId: updated.id, userId: input.userId, tenantId: input.tenantId },
    });

    return { personId: updated.id, userId: updated.userId! };
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
  actorUserId?: string | null;
};

export type UnlinkPersonFromUserResult = { unlinked: boolean };

/**
 * Clears Person.userId only. Idempotent — unlinking an already-unlinked
 * Person is a no-op success. Never deletes/modifies the User row, its
 * TenantMembership, or any UserRole — those are untouched by design.
 */
export async function unlinkPersonFromUser(input: UnlinkPersonFromUserInput): Promise<UnlinkPersonFromUserResult> {
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    select: { id: true, userId: true },
  });
  if (!person) throw new PersonNotFoundError();
  if (!person.userId) return { unlinked: false };

  const previousUserId = person.userId;

  await prisma.person.update({
    where: { id: input.personId },
    data: { userId: null },
  });

  await logAction({
    actorUserId: input.actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Person",
    entityId: person.id,
    action: "UNLINK_USER",
    beforeJson: { personId: person.id, userId: previousUserId },
  });

  return { unlinked: true };
}
