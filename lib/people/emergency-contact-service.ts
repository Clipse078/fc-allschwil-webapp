/**
 * PERSON-UX-10: Emergency contact service.
 *
 * Canonical service for Person emergency contact records.
 *
 * ARCHITECTURAL INVARIANTS (enforced here, not in routes):
 *   - Emergency contacts belong to exactly one Person and tenant.
 *   - The Person MUST belong to the caller's tenant.
 *   - phone is required; email is optional.
 *   - Deleting an emergency contact deletes ONLY that record.
 *     The associated Person is never touched.
 *   - Emergency contacts are private operational data.
 *     They MUST NOT appear in public serializers.
 *   - Ordering: priority ASC, then createdAt ASC.
 */

import { prisma } from "@/lib/db/prisma";

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listEmergencyContacts(
  personId: string,
  tenantId: string,
) {
  return prisma.personEmergencyContact.findMany({
    where: { personId, tenantId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      relationship: true,
      phone: true,
      email: true,
      priority: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type EmergencyContactItem = Awaited<
  ReturnType<typeof listEmergencyContacts>
>[number];

// ── Mutations ─────────────────────────────────────────────────────────────────

export type CreateEmergencyContactInput = {
  tenantId: string;
  personId: string;
  firstName: string;
  lastName: string;
  relationship?: string | null;
  phone: string;
  email?: string | null;
  priority?: number;
  notes?: string | null;
};

export type CreateEmergencyContactResult =
  | { ok: true; contact: { id: string } }
  | { ok: false; status: number; error: string };

export async function createEmergencyContact(
  input: CreateEmergencyContactInput,
): Promise<CreateEmergencyContactResult> {
  const trimmedPhone = input.phone?.trim() ?? "";
  if (!trimmedPhone) {
    return {
      ok: false,
      status: 400,
      error: "Telefonnummer ist erforderlich.",
    };
  }

  const contact = await prisma.personEmergencyContact.create({
    data: {
      tenantId: input.tenantId,
      personId: input.personId,
      firstName: input.firstName.trim().slice(0, 100),
      lastName: input.lastName.trim().slice(0, 100),
      relationship: input.relationship?.trim().slice(0, 100) || null,
      phone: trimmedPhone.slice(0, 50),
      email: input.email?.trim().slice(0, 254) || null,
      priority: input.priority ?? 0,
      notes: input.notes?.trim().slice(0, 500) || null,
    },
    select: { id: true },
  });

  return { ok: true, contact };
}

export type UpdateEmergencyContactInput = {
  contactId: string;
  personId: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  relationship?: string | null;
  phone?: string;
  email?: string | null;
  priority?: number;
  notes?: string | null;
};

export type UpdateEmergencyContactResult =
  | { ok: true; contact: { id: string } }
  | { ok: false; status: number; error: string };

export async function updateEmergencyContact(
  input: UpdateEmergencyContactInput,
): Promise<UpdateEmergencyContactResult> {
  const { contactId, personId, tenantId } = input;

  const existing = await prisma.personEmergencyContact.findUnique({
    where: { id: contactId },
    select: { id: true, personId: true, tenantId: true },
  });

  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.personId !== personId
  ) {
    return {
      ok: false,
      status: 404,
      error: "Notfallkontakt nicht gefunden.",
    };
  }

  // Validate phone if being updated
  if (input.phone !== undefined) {
    const trimmedPhone = input.phone.trim();
    if (!trimmedPhone) {
      return {
        ok: false,
        status: 400,
        error: "Telefonnummer ist erforderlich.",
      };
    }
  }

  const contact = await prisma.personEmergencyContact.update({
    where: { id: contactId },
    data: {
      ...(input.firstName !== undefined && {
        firstName: input.firstName.trim().slice(0, 100),
      }),
      ...(input.lastName !== undefined && {
        lastName: input.lastName.trim().slice(0, 100),
      }),
      ...(input.relationship !== undefined && {
        relationship: input.relationship?.trim().slice(0, 100) || null,
      }),
      ...(input.phone !== undefined && {
        phone: input.phone.trim().slice(0, 50),
      }),
      ...(input.email !== undefined && {
        email: input.email?.trim().slice(0, 254) || null,
      }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.notes !== undefined && {
        notes: input.notes?.trim().slice(0, 500) || null,
      }),
    },
    select: { id: true },
  });

  return { ok: true, contact };
}

export type DeleteEmergencyContactResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Deletes a single emergency contact record.
 *
 * INVARIANT: Deletes ONLY the PersonEmergencyContact row.
 * The associated Person is never modified or deleted.
 */
export async function deleteEmergencyContact(
  contactId: string,
  personId: string,
  tenantId: string,
): Promise<DeleteEmergencyContactResult> {
  const existing = await prisma.personEmergencyContact.findUnique({
    where: { id: contactId },
    select: { id: true, personId: true, tenantId: true },
  });

  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.personId !== personId
  ) {
    return {
      ok: false,
      status: 404,
      error: "Notfallkontakt nicht gefunden.",
    };
  }

  await prisma.personEmergencyContact.delete({ where: { id: contactId } });

  return { ok: true };
}
