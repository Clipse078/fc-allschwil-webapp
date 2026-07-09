import { prisma } from "@/lib/db/prisma";

export async function assertEventBelongsToTenant(eventId: string, tenantId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, tenantId: true },
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  if (!event.tenantId || event.tenantId !== tenantId) {
    throw new Error("Forbidden: event does not belong to tenant.");
  }

  return event;
}

export async function assertTeamBelongsToTenant(teamId: string | null, tenantId: string) {
  if (!teamId) return null;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, tenantId: true },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  if (!team.tenantId || team.tenantId !== tenantId) {
    throw new Error("Forbidden: team does not belong to tenant.");
  }

  return team;
}

export async function assertFacilityResourceBelongsToTenant(
  code: string | null,
  tenantId: string,
  allowedTypes: string[],
) {
  if (!code) return null;

  const resource = await prisma.facilityResource.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code,
      },
    },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      tenantId: true,
    },
  });

  if (!resource) {
    throw new Error(`Facility resource not found: ${code}`);
  }

  if (resource.status !== "ACTIVE") {
    throw new Error(`Facility resource is not active: ${code}`);
  }

  if (!allowedTypes.includes(resource.type)) {
    throw new Error(`Facility resource has invalid type: ${code}`);
  }

  return resource;
}
