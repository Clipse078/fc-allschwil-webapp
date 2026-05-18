/**
 * Meeting query helpers — server-only.
 *
 * All queries now accept an ActorContext and apply VisibilityScope filtering.
 * RESTRICTED records are pre-fetched and filtered in-app via canSeeEntity().
 * PRIVATE records are filtered at DB level (only creator's rows fetched).
 *
 * 404-masking: getMeetingBySlug() and getMeetingById() return null (not 403)
 * for records the actor cannot see, preventing information disclosure.
 *
 * TODO: Phase 2 — push RESTRICTED filtering into the DB query using
 *   PostgreSQL JSONB @> (array contains) for role/user/team overlap checks.
 *   This eliminates the need to fetch-then-discard RESTRICTED records.
 *
 * TODO: Actor context will expand with personId, teamIds, orgUnitIds once
 *   those associations are established on the session/JWT.
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
} as const;

export async function getMeetings(actor: ActorContext) {
  const rows = await prisma.meeting.findMany({
    where: buildVisibilityWhere(actor),
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
  const meeting = await prisma.meeting.findUnique({
    where: { slug },
    select: MEETING_DETAIL_SELECT,
  });
  if (!meeting) return null;
  // 404-mask: return null if actor cannot see this record
  if (!canSeeMeeting(meeting, actor)) return null;
  return meeting;
}

export async function getMeetingById(id: string, actor: ActorContext) {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
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

export type MeetingListItem = Awaited<ReturnType<typeof getMeetings>>[number];
export type MeetingDetail = Awaited<ReturnType<typeof getMeetingBySlug>>;

/**
 * Non-null meeting from getMeetingBySlug — used as prop type across
 * detail sub-cards so they can display live DB data when available.
 */
export type MeetingLiveData = NonNullable<MeetingDetail>;
