/**
 * lib/registrations/registration-delete-service.ts
 *
 * ADMIN-DELETE-03B — permanent hard-delete service for a Registration.
 *
 * Impact: Registration.createdPersons (Person[] with createdRegistrationId FK)
 * — those Person records are NOT deleted; their createdRegistrationId is set
 * to NULL automatically by Prisma (onDelete: SetNull on the FK). All other
 * FK relations on the Registration row itself (tenant, assignedToUser,
 * targetGroup, person, duplicateIgnoredBy) simply disappear with the row.
 *
 * AuditLog entries referencing the registration entityId are not FK-linked
 * and remain as an immutable audit trail after deletion.
 */

import { prisma } from "@/lib/db/prisma";

export type RegistrationDeletionImpact = {
  key: string;
  label: string;
  count: number;
}[];

/**
 * Returns the set of dependent-record counts that will be affected when the
 * registration is permanently deleted. Returns `null` when the registration
 * does not exist or belongs to a different tenant (tenant isolation guard).
 */
export async function getRegistrationDeletionImpact(
  tenantId: string,
  registrationId: string,
): Promise<RegistrationDeletionImpact | null> {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      tenantId: true,
      _count: {
        select: {
          createdPersons: true,
        },
      },
    },
  });

  if (!registration || registration.tenantId !== tenantId) {
    return null;
  }

  const impact: RegistrationDeletionImpact = [];

  if (registration._count.createdPersons > 0) {
    impact.push({
      key: "createdPersons",
      label: "Verknüpfte Personen (Erstellungsreferenz wird getrennt)",
      count: registration._count.createdPersons,
    });
  }

  return impact;
}

/**
 * Permanently deletes the registration. Returns the registration's name for
 * audit logging, or null if the registration was not found or belongs to a
 * different tenant.
 *
 * Prisma handles the SetNull cascade on Person.createdRegistrationId
 * automatically — no manual pre-deletion step is required.
 */
export async function deleteRegistrationPermanently(
  tenantId: string,
  registrationId: string,
): Promise<{ registrationLabel: string } | null> {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!registration || registration.tenantId !== tenantId) {
    return null;
  }

  await prisma.registration.delete({
    where: { id: registrationId },
  });

  return {
    registrationLabel: `${registration.firstName} ${registration.lastName} <${registration.email}>`,
  };
}
