/**
 * lib/people/person-delete-service.ts
 *
 * PERSONS-01-PERMANENT: Service layer for Person permanent hard-delete.
 *
 * Design principles:
 *   • Impact preview never mutates — it only counts dependencies.
 *   • Confirm step runs in a single transaction: clean tenant-local links,
 *     then delete the Person row.
 *   • Global User, TenantMembership, UserRole, and all auth data are
 *     NEVER touched. Person ↔ User is a nullable FK; deleting Person
 *     sets nothing on User (Person.userId FK + onDelete: SetNull means
 *     the User's record of a Person link isn't needed — the Person holds
 *     the FK pointer, not the User).
 *   • PlayerSquadMember / TrainerTeamMember: onDelete: Restrict in schema,
 *     so they must be explicitly deleted before Person. These are squad
 *     memberships within the tenant and dissolve with the Person.
 *   • OrgUnitMembership: onDelete: SetNull for personId → automatically
 *     nulled; no explicit cleanup needed.
 *   • PersonAssignment: onDelete: Cascade on Person → automatically deleted.
 *   • linkedRegistrations (Registration.personId): onDelete: SetNull → auto.
 */

import { prisma } from "@/lib/db/prisma";

export type PersonDeletionImpact = {
  /** Squad memberships (PlayerSquadMember) — will be deleted */
  squadMemberships: number;
  /** Trainer/staff team memberships (TrainerTeamMember) — will be deleted */
  trainerMemberships: number;
  /** PersonAssignment rows — will be deleted (cascade) */
  personAssignments: number;
  /** OrgUnitMembership rows where personId is set — will be nulled */
  orgUnitMemberships: number;
  /** Linked registrations (Registration.personId) — will be nulled */
  linkedRegistrations: number;
  /** Global User survives: identity is preserved */
  linkedUserId: string | null;
  linkedUserEmail: string | null;
};

/**
 * Returns the deletion impact for a Person within the given tenant.
 * Returns null when the Person does not exist or belongs to a different tenant.
 * Never mutates.
 */
export async function getPersonDeletionImpact(
  tenantId: string,
  personId: string,
): Promise<PersonDeletionImpact | null> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      tenantId: true,
      userId: true,
      user: { select: { id: true, email: true } },
      _count: {
        select: {
          playerSquadMembers: true,
          trainerTeamMembers: true,
          personAssignments: true,
          orgUnitMemberships: true,
          linkedRegistrations: true,
        },
      },
    },
  });

  if (!person || person.tenantId !== tenantId) return null;

  return {
    squadMemberships: person._count.playerSquadMembers,
    trainerMemberships: person._count.trainerTeamMembers,
    personAssignments: person._count.personAssignments,
    orgUnitMemberships: person._count.orgUnitMemberships,
    linkedRegistrations: person._count.linkedRegistrations,
    linkedUserId: person.user?.id ?? null,
    linkedUserEmail: person.user?.email ?? null,
  };
}

export type PersonDeletionResult = {
  personId: string;
  firstName: string;
  lastName: string;
  impact: PersonDeletionImpact;
};

/**
 * Permanently deletes a Person within the given tenant in a single transaction.
 *
 * Cleanup order:
 *   1. PlayerSquadMember (Restrict FK — must go first)
 *   2. TrainerTeamMember (Restrict FK — must go first)
 *   3. PersonAssignment (Cascade — explicit for audit clarity)
 *   4. Person (FK nulling of OrgUnitMembership.personId + Registration.personId
 *      happens automatically via onDelete: SetNull on those relations)
 *
 * Global User, TenantMembership, UserRole, sessions: never touched.
 *
 * Returns null when the Person does not exist in the tenant (idempotent-safe).
 */
export async function deletePersonPermanently(
  tenantId: string,
  personId: string,
): Promise<PersonDeletionResult | null> {
  // Fetch snapshot for audit + return value (outside transaction is fine; if the
  // entity disappears between here and the tx we'll return null cleanly).
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      tenantId: true,
      firstName: true,
      lastName: true,
      userId: true,
      user: { select: { id: true, email: true } },
      _count: {
        select: {
          playerSquadMembers: true,
          trainerTeamMembers: true,
          personAssignments: true,
          orgUnitMemberships: true,
          linkedRegistrations: true,
        },
      },
    },
  });

  if (!person || person.tenantId !== tenantId) return null;

  const impact: PersonDeletionImpact = {
    squadMemberships: person._count.playerSquadMembers,
    trainerMemberships: person._count.trainerTeamMembers,
    personAssignments: person._count.personAssignments,
    orgUnitMemberships: person._count.orgUnitMemberships,
    linkedRegistrations: person._count.linkedRegistrations,
    linkedUserId: person.user?.id ?? null,
    linkedUserEmail: person.user?.email ?? null,
  };

  await prisma.$transaction(async (tx) => {
    // Step 1: Remove squad and trainer memberships (Restrict FKs — must precede Person delete).
    await tx.playerSquadMember.deleteMany({ where: { personId } });
    await tx.trainerTeamMember.deleteMany({ where: { personId } });

    // Step 2: PersonAssignment rows (also Cascade, but explicit for clarity).
    await tx.personAssignment.deleteMany({ where: { personId } });

    // Step 3: Delete the Person. OrgUnitMembership.personId → SetNull automatically.
    // Registration.personId → SetNull automatically. Person.userId → not touched
    // (User holds no FK back to Person; Person.userId is the pointer).
    await tx.person.delete({ where: { id: personId } });
  });

  return {
    personId,
    firstName: person.firstName,
    lastName: person.lastName,
    impact,
  };
}
