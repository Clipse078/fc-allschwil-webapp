import { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { attachPersonMatchSummaries } from "@/lib/registrations/person-match";

const registrationSelect = {
  id: true,
  type: true,
  status: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  birthDate: true,
  birthYear: true,
  message: true,
  payloadJson: true,
  source: true,
  assignedToUserId: true,
  targetGroupId: true,
  personId: true,
  duplicateIgnoredAt: true,
  duplicateIgnoredById: true,
  contactedAt: true,
  archivedAt: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  tenant: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
  assignedToUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  targetGroup: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
  duplicateIgnoredBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.RegistrationSelect;

type RegistrationRecord = Prisma.RegistrationGetPayload<{
  select: typeof registrationSelect;
}>;

type UpdateRegistrationInput = {
  status?: RegistrationStatus;
  assignedToUserId?: string | null;
  targetGroupId?: string | null;
  /** REGISTRATION-01F — Goal 2/3: link (or unlink) an existing/newly-created Person. */
  personId?: string | null;
  /** REGISTRATION-01F — Goal 7: dismiss the duplicate warning explicitly. */
  duplicateIgnored?: boolean;
};

function serializeRegistration(registration: RegistrationRecord) {
  return {
    ...registration,
    birthDate: registration.birthDate?.toISOString() ?? null,
    submittedAt: registration.submittedAt.toISOString(),
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
    duplicateIgnoredAt: registration.duplicateIgnoredAt?.toISOString() ?? null,
    contactedAt: registration.contactedAt?.toISOString() ?? null,
    archivedAt: registration.archivedAt?.toISOString() ?? null,
  };
}

// ── Duplicate reference enrichment (REGISTRATION-01E, Goal 2) ──────────────
//
// Duplicate DETECTION is unchanged (see public-submission.ts). This only
// reads the existing `possibleDuplicate` / `possibleDuplicateOf` payload
// keys and resolves the referenced registration's basic display info
// (name/status/submittedAt) so the UI can show "Registration from … ·
// Status: …" and a direct link, instead of a bare internal ID.

type DuplicateReferenceSummary = {
  id: string;
  firstName: string;
  lastName: string;
  status: RegistrationStatus;
  submittedAt: string;
};

function extractDuplicateReferenceId(payloadJson: unknown): string | null {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    return null;
  }
  const p = payloadJson as Record<string, unknown>;
  if (p.possibleDuplicate !== true) return null;
  return typeof p.possibleDuplicateOf === "string" && p.possibleDuplicateOf.trim()
    ? p.possibleDuplicateOf.trim()
    : null;
}

async function attachDuplicateReferences<T extends { payloadJson: unknown }>(
  tenantId: string,
  registrations: T[],
): Promise<(T & { duplicateReference: DuplicateReferenceSummary | null })[]> {
  const referenceIds = Array.from(
    new Set(
      registrations
        .map((r) => extractDuplicateReferenceId(r.payloadJson))
        .filter((id): id is string => !!id),
    ),
  );

  if (referenceIds.length === 0) {
    return registrations.map((r) => ({ ...r, duplicateReference: null }));
  }

  const references = await prisma.registration.findMany({
    where: { id: { in: referenceIds }, tenantId },
    select: { id: true, firstName: true, lastName: true, status: true, submittedAt: true },
  });

  const referenceMap = new Map<string, DuplicateReferenceSummary>(
    references.map((r) => [r.id, { ...r, submittedAt: r.submittedAt.toISOString() }]),
  );

  return registrations.map((r) => {
    const refId = extractDuplicateReferenceId(r.payloadJson);
    return {
      ...r,
      duplicateReference: refId ? (referenceMap.get(refId) ?? null) : null,
    };
  });
}

// ── Person match enrichment (REGISTRATION-01F, Goal 2) ─────────────────────
//
// Wraps attachPersonMatchSummaries so both list + detail reads get the same
// "NONE / POSSIBLE / CONFIRMED / LINKED" projection used to drive the
// "Needs person" / "Already linked" filters (Goal 9) and the Person
// section of the detail view.

async function attachPersonMatches<
  T extends {
    personId: string | null;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
  },
>(registrations: T[]) {
  return attachPersonMatchSummaries(registrations);
}

export async function listRegistrationsForTenant(tenantSlug: string) {
  const tenant = await requireTenant(tenantSlug);

  const registrations = await prisma.registration.findMany({
    where: {
      tenantId: tenant.id,
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: registrationSelect,
  });

  const serialized = registrations.map(serializeRegistration);
  const withDuplicates = await attachDuplicateReferences(tenant.id, serialized);
  return attachPersonMatches(withDuplicates);
}

export async function getRegistrationForTenant(
  tenantSlug: string,
  registrationId: string
) {
  const tenant = await requireTenant(tenantSlug);

  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      tenantId: tenant.id,
    },
    select: registrationSelect,
  });

  if (!registration) return null;

  const [enriched] = await attachDuplicateReferences(tenant.id, [
    serializeRegistration(registration),
  ]);
  const [withPersonMatch] = await attachPersonMatches([enriched]);
  return withPersonMatch;
}

export async function updateRegistrationStatusForTenant(
  tenantSlug: string,
  registrationId: string,
  input: UpdateRegistrationInput,
  actorUserId: string | null = null,
) {
  const tenant = await requireTenant(tenantSlug);

  const existing = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      tenantId: tenant.id,
    },
    select: registrationSelect,
  });

  if (!existing) {
    return null;
  }

  if (input.assignedToUserId) {
    // Tenant-scoped: assignee must belong to the same tenant.
    const assignee = await prisma.user.findFirst({
      where: { id: input.assignedToUserId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!assignee) {
      throw new Error("Assigned user not found or belongs to a different tenant.");
    }
  }

  if (input.targetGroupId) {
    // Tenant-scoped: target group must belong to this tenant or be global (tenantId IS NULL).
    const targetGroup = await prisma.targetGroup.findFirst({
      where: {
        id: input.targetGroupId,
        OR: [{ tenantId: tenant.id }, { tenantId: null }],
      },
      select: { id: true },
    });
    if (!targetGroup) {
      throw new Error("Target group not found or belongs to a different tenant.");
    }
  }

  if (input.personId) {
    // REG-WAIT-01: Person IS tenant-scoped (tenantId added in PERSONS-01).
    // Validate that the Person belongs to the same tenant as the Registration.
    const person = await prisma.person.findFirst({
      where: { id: input.personId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!person) {
      throw new Error("Person nicht gefunden oder gehört zu einem anderen Mandanten.");
    }
  }

  // REGISTRATION-01F — Goal 6/8: quick actions ("Mark Contacted" / "Archive")
  // PATCH {status: "CONTACTED" | "ARCHIVED"} through the same endpoint as
  // the status dropdown; stamp the dedicated timestamp whenever that
  // specific status is (re-)reached so the timeline / KPIs have exact times.
  const contactedAt = input.status === "CONTACTED" ? new Date() : undefined;
  const archivedAt = input.status === "ARCHIVED" ? new Date() : undefined;

  const duplicateIgnoreData = input.duplicateIgnored
    ? { duplicateIgnoredAt: new Date(), duplicateIgnoredById: actorUserId }
    : {};

  const updated = await prisma.registration.update({
    where: {
      id: existing.id,
    },
    data: {
      status: input.status,
      assignedToUserId:
        input.assignedToUserId === undefined
          ? undefined
          : input.assignedToUserId,
      targetGroupId:
        input.targetGroupId === undefined ? undefined : input.targetGroupId,
      personId: input.personId === undefined ? undefined : input.personId,
      contactedAt,
      archivedAt,
      ...duplicateIgnoreData,
    },
    select: registrationSelect,
  });

  const [serializedBefore, serializedUpdated] = await attachDuplicateReferences(tenant.id, [
    serializeRegistration(existing),
    serializeRegistration(updated),
  ]);
  const [withMatchBefore, withMatchUpdated] = await attachPersonMatches([
    serializedBefore,
    serializedUpdated,
  ]);

  return {
    before: withMatchBefore,
    registration: withMatchUpdated,
  };
}

export type RegistrationListItem = Awaited<
  ReturnType<typeof listRegistrationsForTenant>
>[number];
export type RegistrationDetail = NonNullable<
  Awaited<ReturnType<typeof getRegistrationForTenant>>
>;
