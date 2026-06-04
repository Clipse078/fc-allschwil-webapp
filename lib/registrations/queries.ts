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

export async function listRegistrationsForTenant(tenantSlug: string) {
  const tenant = await requireTenant(tenantSlug);

  const registrations = await prisma.registration.findMany({
    where: {
      tenantId: tenant.id,
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: registrationSelect,
  });

  return registrations.map(serializeRegistration);
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

  return registration ? serializeRegistration(registration) : null;
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

  return {
    before: serializeRegistration(existing),
    registration: serializeRegistration(updated),
  };
}

export type RegistrationListItem = Awaited<
  ReturnType<typeof listRegistrationsForTenant>
>[number];
export type RegistrationDetail = NonNullable<
  Awaited<ReturnType<typeof getRegistrationForTenant>>
>;
