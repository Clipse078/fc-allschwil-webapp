import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "@/lib/visibility/actor-context";

type StrategicSummaryActor = Pick<
  ActorContext,
  "tenantId" | "userId" | "permissionKeys"
>;

function hasAnyPermission(
  actor: StrategicSummaryActor,
  permissionKeys: readonly string[],
) {
  return actor.permissionKeys.some((key) => permissionKeys.includes(key));
}

export async function getDashboardMeetingSummary(
  actor: StrategicSummaryActor | null,
  now = new Date(),
) {
  if (
    !actor?.tenantId ||
    !hasAnyPermission(actor, ["meetings.view", "meetings.manage"])
  ) {
    return { recentMeetings: [], upcomingMeetings: [] };
  }

  const tenantId = actor.tenantId;
  const [recentMeetings, upcomingMeetings] = await Promise.all([
    prisma.meeting.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, title: true, createdAt: true, slug: true },
    }),
    prisma.meeting.findMany({
      where: {
        tenantId,
        meetingDate: { gte: now },
        status: "PLANNED",
      },
      orderBy: { meetingDate: "asc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        meetingDate: true,
        location: true,
      },
    }),
  ]);

  return { recentMeetings, upcomingMeetings };
}

export async function getOperativeStrategicCounts(
  actor: StrategicSummaryActor,
  now = new Date(),
) {
  if (!actor.tenantId) {
    return {
      activeTargetCount: 0,
      plannedMeetingCount: 0,
      overdueActionCount: 0,
    };
  }

  const tenantId = actor.tenantId;
  const canReadTargets = hasAnyPermission(actor, [
    "targets.view",
    "targets.manage",
  ]);
  const canReadMeetings = hasAnyPermission(actor, [
    "meetings.view",
    "meetings.manage",
  ]);

  const [activeTargetCount, plannedMeetingCount, overdueActionCount] =
    await Promise.all([
      canReadTargets
        ? prisma.target.count({ where: { tenantId, status: "ACTIVE" } })
        : Promise.resolve(0),
      canReadMeetings
        ? prisma.meeting.count({
            where: {
              tenantId,
              status: "PLANNED",
              OR: [
                { visibilityScope: "ORGANISATION" },
                { createdByUserId: actor.userId },
              ],
            },
          })
        : Promise.resolve(0),
      canReadMeetings
        ? prisma.meetingAction.count({
            where: {
              status: "OPEN",
              dueDate: { lt: now },
              meeting: {
                tenantId,
                OR: [
                  { visibilityScope: "ORGANISATION" },
                  { createdByUserId: actor.userId },
                ],
              },
            },
          })
        : Promise.resolve(0),
    ]);

  return { activeTargetCount, plannedMeetingCount, overdueActionCount };
}
