/**
 * lib/registrations/person-creation.ts
 *
 * REGISTRATION-01F — Goal 3: "Create Person" workflow action.
 *
 * Copies registration data (player, address, contacts, guardian, football
 * where relevant) into a new Person record, links Registration → Person,
 * and stamps provenance (createdFromRegistration / createdRegistrationId).
 *
 * Goal 11 (safety): if `findPersonMatches` reports a possible/confirmed
 * match, creation is refused unless the caller explicitly confirms
 * (`confirmDespiteMatch: true`) — a Person is never created silently next
 * to a likely-duplicate record.
 */

import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { logAction } from "@/lib/audit/log-action";
import { getRegistrationDetailFields, type RegistrationRawShape } from "@/lib/registrations/detail-view";
import { findPersonMatches, type PersonMatchCandidate } from "@/lib/registrations/person-match";

export type CreatePersonFromRegistrationResult =
  | { ok: true; personId: string }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "ALREADY_LINKED"; personId: string }
  | { ok: false; reason: "POSSIBLE_MATCH"; candidates: PersonMatchCandidate[] };

type RegistrationForCreation = RegistrationRawShape & {
  id: string;
  tenantId: string;
  phone: string | null;
  personId: string | null;
};

export async function createPersonFromRegistration(
  tenantSlug: string,
  registrationId: string,
  options: { confirmDespiteMatch?: boolean },
  actorUserId: string | null,
): Promise<CreatePersonFromRegistrationResult> {
  const tenant = await requireTenant(tenantSlug);

  const registration = (await prisma.registration.findFirst({
    where: { id: registrationId, tenantId: tenant.id },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      birthYear: true,
      message: true,
      payloadJson: true,
      source: true,
      submittedAt: true,
      personId: true,
    },
  })) as (RegistrationForCreation & { submittedAt: Date; birthDate: Date | null }) | null;

  if (!registration) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (registration.personId) {
    return { ok: false, reason: "ALREADY_LINKED", personId: registration.personId };
  }

  if (!options.confirmDespiteMatch) {
    const match = await findPersonMatches({
      email: registration.email,
      phone: registration.phone,
      firstName: registration.firstName,
      lastName: registration.lastName,
    });
    if (match.status !== "NONE") {
      return { ok: false, reason: "POSSIBLE_MATCH", candidates: match.candidates };
    }
  }

  const fields = getRegistrationDetailFields({
    id: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email: registration.email,
    phone: registration.phone,
    birthDate: registration.birthDate ? registration.birthDate.toISOString() : null,
    birthYear: registration.birthYear,
    message: registration.message,
    payloadJson: registration.payloadJson,
    source: registration.source,
    submittedAt: registration.submittedAt.toISOString(),
  });

  const notesParts = [
    "Automatisch erstellt aus Registrierung",
    fields.additional.message ? `Nachricht: ${fields.additional.message}` : null,
    fields.additional.remarks ? `Bemerkungen: ${fields.additional.remarks}` : null,
  ].filter(Boolean);

  const [firstGuardianName, ...restGuardianName] = (fields.parent?.name ?? "").split(" ");
  const guardianFirstName = fields.parent?.name ? firstGuardianName || null : null;
  const guardianLastName = fields.parent?.name ? restGuardianName.join(" ") || null : null;

  const { person, updatedRegistration } = await prisma.$transaction(async (tx) => {
    const createdPerson = await tx.person.create({
      data: {
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email || null,
        phone: registration.phone || null,
        dateOfBirth: registration.birthDate ?? undefined,
        notes: notesParts.join("\n") || null,
        isActive: true,
        // Player-oriented registrations default to isPlayer=true; other
        // registration types (sponsor, contact, …) leave both flags false.
        isPlayer: fields.football !== null || !!registration.birthYear,
        street: fields.address.street,
        houseNumber: fields.address.houseNumber,
        postalCode: fields.address.postalCode,
        city: fields.address.city,
        country: fields.address.country,
        guardianFirstName,
        guardianLastName,
        guardianEmail: fields.parent?.email ?? null,
        guardianPhone: fields.parent?.phone ?? null,
        footballJson: fields.football ? (fields.football as unknown as import("@prisma/client").Prisma.InputJsonObject) : undefined,
        createdFromRegistration: true,
        createdRegistrationId: registration.id,
        // PERSONS-01-C1: tenantId is required (NOT NULL) — inherit from registration
        tenantId: registration.tenantId,
      },
      select: { id: true },
    });

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: { personId: createdPerson.id },
      select: { id: true, personId: true },
    });

    return { person: createdPerson, updatedRegistration: updated };
  });

  void logAction({
    actorUserId,
    moduleKey: "registrations",
    entityType: "Registration",
    entityId: registration.id,
    action: "PERSON_CREATED",
    afterJson: { personId: person.id },
    metadataJson: { tenantSlug, confirmedDespiteMatch: !!options.confirmDespiteMatch },
  });

  return { ok: true, personId: updatedRegistration.personId! };
}
