/**
 * Meeting query helpers — server-only.
 *
 * VISIBILITY WARNING: These queries currently return ALL meetings to every
 * authenticated caller with no scope filtering. This is intentional for
 * Phase 1 (small, known user base) but MUST be replaced before the system
 * is used for sensitive board content.
 *
 * Phase 2 — visibility-aware queries:
 *
 *   getMeetings(actorContext: ActorContext): Promise<MeetingListItem[]>
 *
 *   where ActorContext = {
 *     userId: string;
 *     roleKeys: string[];
 *     teamIds: string[];
 *     orgUnitIds: string[];   // future OrgUnit model
 *   }
 *
 *   The query must add a `where` clause that filters on visibilityScope:
 *     ORGANISATION → no additional filter (return all)
 *     RESTRICTED   → return only if actor matches any allowedOrgUnitIds /
 *                    allowedRoleKeys / allowedTeamIds / allowedPersonIds
 *     PRIVATE      → return only if actor.userId === createdByUserId
 *                    or actor.userId is in allowedPersonIds
 *
 *   getMeetingBySlug() must enforce the same check and return null (not throw)
 *   for meetings outside the actor's visibility — the page treats null as "not
 *   found" and renders the fallback, preventing information leakage via 404 vs 403.
 *
 * TODO: add getMeetingLinkOptions(actorContext) variant used by TargetLinkEditor
 *   so that cross-module links can only point to meetings the actor can see.
 */

import { prisma } from "@/lib/db/prisma";

// TODO: replace with visibility-filtered version once VisibilityScope is in schema.
// Until then, ALL meetings are returned regardless of sensitivity. Do not record
// confidential content in the DB before Phase 2 access control is in place.
export async function getMeetings() {
  return prisma.meeting.findMany({
    orderBy: { meetingDate: "desc" },
    select: {
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
    },
  });
}

// TODO: enforce visibility check — return null if actor cannot see this record,
// NOT a 403 (to avoid disclosing the existence of restricted meetings).
export async function getMeetingBySlug(slug: string) {
  return prisma.meeting.findUnique({
    where: { slug },
    select: {
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
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getMeetingById(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    select: {
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
      reviewedByUserId: true,
      reviewedAt: true,
    },
  });
}

export type MeetingListItem = Awaited<ReturnType<typeof getMeetings>>[number];
export type MeetingDetail = Awaited<ReturnType<typeof getMeetingBySlug>>;

/**
 * Non-null meeting from getMeetingBySlug — used as prop type across
 * detail sub-cards so they can display live DB data when available.
 */
export type MeetingLiveData = NonNullable<MeetingDetail>;
