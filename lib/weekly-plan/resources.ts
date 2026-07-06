import { FacilityResourceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getActiveWeeklyPlanResources(tenantId: string) {
  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
    },
    include: {
      facility: {
        select: {
          id: true,
          name: true,
          type: true,
          sortOrder: true,
        },
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  return {
    pitchResources: resources.filter((resource) =>
      resource.type === FacilityResourceType.FULL_PITCH ||
      resource.type === FacilityResourceType.HALF_PITCH
    ),
    dressingRoomResources: resources.filter((resource) =>
      resource.type === FacilityResourceType.DRESSING_ROOM
    ),
    otherResources: resources.filter((resource) =>
      resource.type !== FacilityResourceType.FULL_PITCH &&
      resource.type !== FacilityResourceType.HALF_PITCH &&
      resource.type !== FacilityResourceType.DRESSING_ROOM
    ),
  };
}
