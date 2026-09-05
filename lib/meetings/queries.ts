/**
 * Meeting query helpers — server-only.
 *
 * All queries accept an ActorContext and apply VisibilityScope filtering.
 * RESTRICTED records are pre-fetched and filtered in-app via canSeeEntity().
 * PRIVATE records are filtered at DB level (only creator's rows fetched).
 *
 * 404-masking: getMeetingBySlug() and getMeetingById() return null (not 403)
 * for records the actor cannot see, preventing information disclosure.
 *
 * Roadmap:
 *   - Push RESTRICTED filtering into DB using JSONB @> queries (Phase 2).
 *   - actor.teamIds / actor.personId for visibleTeamRefs / visiblePersonRefs.
 *   - Cache actor.orgUnitIds in JWT to eliminate per-request DB query.
 */

import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { buildVisibilityWhere, applyVisibilityFilter } from "@/lib/visibility/visibility-filter";

const MEETING_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  meetingDate: true,
  location: true,
  attendeeCount: true,
  status: true,
  reviewStage: true,
  requiresFourEyeReview: true,
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
  // Phase D: target group visibility refs
  visibleTargetGroupRefs: true,
} as const;

export async function getMeetings(actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["meetings.view", "meetings.manage"].includes(key),
    )
  ) return [];
  const rows = await prisma.meeting.findMany({
    where: { tenantId: actor.tenantId, ...buildVisibilityWhere(actor) },
    orderBy: { meetingDate: "desc" },
    select: MEETING_LIST_SELECT,
  });
  return applyVisibilityFilter(rows, actor);
}

const MEETING_DETAIL_SELECT = {
  ...MEETING_LIST_SELECT,
  reviewedByUserId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getMeetingBySlug(slug: string, actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["meetings.view", "meetings.manage"].includes(key),
    )
  ) return null;
  const meeting = await prisma.meeting.findFirst({
    where: { slug, tenantId: actor.tenantId },
    select: MEETING_DETAIL_SELECT,
  });
  if (!meeting) return null;
  // 404-mask: return null if actor cannot see this record
  if (!canSeeMeeting(meeting, actor)) return null;
  return meeting;
}

export async function getMeetingById(id: string, actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["meetings.view", "meetings.manage"].includes(key),
    )
  ) return null;
  const meeting = await prisma.meeting.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: MEETING_DETAIL_SELECT,
  });
  if (!meeting) return null;
  if (!canSeeMeeting(meeting, actor)) return null;
  return meeting;
}

// Re-export the check so API route handlers can call it without re-fetching
import { canSeeEntity } from "@/lib/visibility/visibility-filter";
export function canSeeMeeting(
  meeting: { visibilityScope: string; createdByUserId: string | null; visibleRoleRefs: unknown; visibleUserRefs: unknown; visibleTeamRefs: unknown; visibleOrgUnitRefs: unknown; visiblePersonRefs: unknown },
  actor: ActorContext,
) {
  return canSeeEntity(meeting as Parameters<typeof canSeeEntity>[0], actor);
}

export async function getMeetingSubEntities(meetingId: string) {
  const [agendaItems, decisions, actions, participants] = await Promise.all([
    prisma.meetingAgendaItem.findMany({
      where: { meetingId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, notes: true, owner: true, durationMin: true, orderIndex: true, status: true },
    }),
    prisma.meetingDecision.findMany({
      where: { meetingId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, description: true, status: true, owner: true, orderIndex: true },
    }),
    prisma.meetingAction.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, owner: true, dueDate: true, status: true },
    }),
    prisma.meetingParticipant.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, role: true, status: true, userId: true },
    }),
  ]);
  return { agendaItems, decisions, actions, participants };
}

export type MeetingSubEntities = Awaited<ReturnType<typeof getMeetingSubEntities>>;
export type MeetingListItem = Awaited<ReturnType<typeof getMeetings>>[number];
export type MeetingDetail = Awaited<ReturnType<typeof getMeetingBySlug>>;

/**
 * Non-null meeting from getMeetingBySlug — used as prop type across
 * detail sub-cards so they can display live DB data when available.
 */
export type MeetingLiveData = NonNullable<MeetingDetail>;
