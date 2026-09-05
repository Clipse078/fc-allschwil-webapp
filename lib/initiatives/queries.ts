/**
 * Initiative query helpers — server-only.
 *
 * All queries now accept an ActorContext and apply VisibilityScope filtering.
 * Same strategy as lib/meetings/queries.ts — see that file for full rationale.
 *
 * 404-masking: getInitiativeBySlug() and getInitiativeById() return null for
 * records the actor cannot see, preventing information disclosure.
 */

import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { buildVisibilityWhere, applyVisibilityFilter, canSeeEntity } from "@/lib/visibility/visibility-filter";

const INITIATIVE_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  owner: true,
  progress: true,
  dueDate: true,
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

export async function getInitiatives(actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["initiatives.view", "initiatives.manage"].includes(key),
    )
  ) return [];
  const rows = await prisma.initiative.findMany({
    where: { tenantId: actor.tenantId, ...buildVisibilityWhere(actor) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: INITIATIVE_LIST_SELECT,
  });
  return applyVisibilityFilter(rows, actor);
}

const INITIATIVE_DETAIL_SELECT = {
  ...INITIATIVE_LIST_SELECT,
  description: true,
  reviewedByUserId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getInitiativeBySlug(slug: string, actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["initiatives.view", "initiatives.manage"].includes(key),
    )
  ) return null;
  const initiative = await prisma.initiative.findFirst({
    where: { slug, tenantId: actor.tenantId },
    select: INITIATIVE_DETAIL_SELECT,
  });
  if (!initiative) return null;
  if (!canSeeEntity(initiative, actor)) return null;
  return initiative;
}

export async function getInitiativeById(id: string, actor: ActorContext) {
  if (
    !actor.tenantId ||
    !actor.permissionKeys.some((key) =>
      ["initiatives.view", "initiatives.manage"].includes(key),
    )
  ) return null;
  const initiative = await prisma.initiative.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: INITIATIVE_DETAIL_SELECT,
  });
  if (!initiative) return null;
  if (!canSeeEntity(initiative, actor)) return null;
  return initiative;
}

export type InitiativeListItem = Awaited<ReturnType<typeof getInitiatives>>[number];
export type InitiativeDetail = Awaited<ReturnType<typeof getInitiativeBySlug>>;
