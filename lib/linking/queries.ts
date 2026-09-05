/**
 * Server-side query helpers for cross-module link options.
 *
 * Both getMeetingLinkOptions() and getInitiativeLinkOptions() accept an
 * ActorContext and apply visibility filtering — RESTRICTED/PRIVATE records
 * outside the actor's scope are excluded from link option lists.
 *
 * Usage: call from a server component (page.tsx), then pass results as props
 * to the client component TargetLinkEditor — keeps DB access server-side.
 *
 * Roadmap:
 *   - FK promotion: replace linkedInitiativeRefs / linkedMeetingRefs JSONB with
 *     proper junction tables (TargetInitiative, TargetMeeting) once link sets
 *     stabilise and require query-side filtering/joins.
 *   - Contribution scoring: contributionWeight on junction table when
 *     Initiative.progress feeds a linked Target's secondary signal.
 *   - Polymorphic relation table if same pattern needed across many module pairs.
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
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["meetings.view", "meetings.manage"].includes(key),
    )
  ) return [];
  const rows = await prisma.meeting.findMany({
    where: { tenantId: actor.tenantId, ...buildVisibilityWhere(actor) },
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
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["initiatives.view", "initiatives.manage"].includes(key),
    )
  ) return [];
  const rows = await prisma.initiative.findMany({
    where: { tenantId: actor.tenantId, ...buildVisibilityWhere(actor) },
    orderBy: { title: "asc" },
    select: { slug: true, title: true, ...LINK_OPTION_VISIBILITY_SELECT },
  });
  return applyVisibilityFilter(rows, actor).map((i) => ({
    slug: i.slug,
    title: i.title,
    url: `/vereinsleitung/initiativen/${i.slug}`,
  }));
}
