/**
 * Server-side query helpers for cross-module link options.
 *
 * These replace the static MEETING_STUBS / INITIATIVE_STUBS arrays with
 * real DB queries, giving the TargetLinkEditor access to all DB-registered
 * entities rather than a hardcoded 3-item list.
 *
 * Usage: call from a server component (page.tsx), then pass results as props
 * to the client component TargetLinkEditor — keeps DB access server-side.
 *
 * TODO: Phase 2 — visibility-aware link options
 *   getMeetingLinkOptions() and getInitiativeLinkOptions() must accept an
 *   ActorContext and exclude records outside the actor's visibility scope.
 *   Otherwise a user could create a cross-link to a RESTRICTED meeting they
 *   cannot see, indirectly learning that it exists.
 *
 * TODO: Phase 2 — FK promotion
 *   Replace Target.linkedInitiativeRefs / Target.linkedMeetingRefs JSONB with
 *   proper junction tables (TargetInitiative, TargetMeeting) once these link
 *   sets stabilise and require query-side filtering/joins.
 *
 * TODO: Future — automatic contribution scoring
 *   When Initiative.progress contributes to a linked Target's secondary signal,
 *   add a contributionWeight field to the junction table and aggregate here.
 *
 * TODO: Future — polymorphic relation table
 *   If the same linking pattern is needed across many module pairs, evaluate a
 *   generic EntityLink model { sourceType, sourceId, targetType, targetId } to
 *   avoid per-pair migration proliferation.
 */

import { prisma } from "@/lib/db/prisma";
import type { EntityRef } from "./types";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { buildVisibilityWhere, applyVisibilityFilter } from "@/lib/visibility/visibility-filter";

const LINK_OPTION_VISIBILITY_SELECT = {
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
} as const;

/**
 * Visible meetings for the link editor — respects VisibilityScope.
 * Only meetings the actor can see are returned, preventing cross-link
 * disclosure of restricted/private records.
 */
export async function getMeetingLinkOptions(actor: ActorContext): Promise<EntityRef[]> {
  const rows = await prisma.meeting.findMany({
    where: buildVisibilityWhere(actor),
    orderBy: { meetingDate: "desc" },
    select: { slug: true, title: true, ...LINK_OPTION_VISIBILITY_SELECT },
  });
  return applyVisibilityFilter(rows, actor).map((m) => ({
    slug: m.slug,
    title: m.title,
    url: `/vereinsleitung/meetings/${m.slug}`,
  }));
}

/**
 * Visible initiatives for the link editor — respects VisibilityScope.
 */
export async function getInitiativeLinkOptions(actor: ActorContext): Promise<EntityRef[]> {
  const rows = await prisma.initiative.findMany({
    where: buildVisibilityWhere(actor),
    orderBy: { title: "asc" },
    select: { slug: true, title: true, ...LINK_OPTION_VISIBILITY_SELECT },
  });
  return applyVisibilityFilter(rows, actor).map((i) => ({
    slug: i.slug,
    title: i.title,
    url: `/vereinsleitung/initiativen/${i.slug}`,
  }));
}
