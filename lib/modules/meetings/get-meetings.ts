import { prisma } from "@/lib/db/prisma";
import { canAccessScopedEntity } from "@/lib/scoped/can-access-scoped-entity";
import { getCurrentScopedActor } from "@/lib/scoped/get-current-scoped-actor";

export async function getMeetings() {
  const actor = await getCurrentScopedActor();

  const meetings = await prisma.vereinsleitungMeeting.findMany({
    orderBy: [{ startAt: "desc" }],
  });

  return meetings.filter((meeting) =>
    canAccessScopedEntity(
      {
        // TEMP: fallback until DB has real fields
        audience: { isPublic: true },
      },
      {
        personId: actor.personId,
        roleIds: actor.roleIds,
      }
    )
  );
}
