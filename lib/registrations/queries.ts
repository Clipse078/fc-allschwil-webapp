import { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";

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
} satisfies Prisma.RegistrationSelect;

type RegistrationRecord = Prisma.RegistrationGetPayload<{
  select: typeof registrationSelect;
}>;

type UpdateRegistrationInput = {
  status?: RegistrationStatus;
  assignedToUserId?: string | null;
  targetGroupId?: string | null;
};

function serializeRegistration(registration: RegistrationRecord) {
  return {
    ...registration,
    birthDate: registration.birthDate?.toISOString() ?? null,
    submittedAt: registration.submittedAt.toISOString(),
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
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
  return attachDuplicateReferences(tenant.id, serialized);
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
  return enriched;
}

export async function updateRegistrationStatusForTenant(
  tenantSlug: string,
  registrationId: string,
  input: UpdateRegistrationInput
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
    },
    select: registrationSelect,
  });

  const [serializedBefore, serializedUpdated] = await attachDuplicateReferences(tenant.id, [
    serializeRegistration(existing),
    serializeRegistration(updated),
  ]);

  return {
    before: serializedBefore,
    registration: serializedUpdated,
  };
}

export type RegistrationListItem = Awaited<
  ReturnType<typeof listRegistrationsForTenant>
>[number];
export type RegistrationDetail = NonNullable<
  Awaited<ReturnType<typeof getRegistrationForTenant>>
>;
