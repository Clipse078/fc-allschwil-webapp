/**
 * Initiative query helpers — server-only.
 *
 * VISIBILITY WARNING: These queries currently return ALL initiatives to every
 * authenticated caller with no scope filtering. This is intentional for
 * Phase 1 (small, known user base) but MUST be replaced before the system
 * is used for sensitive initiatives (e.g. confidential restructuring, personnel
 * matters, or financial negotiations).
 *
 * Phase 2 — visibility-aware queries follow the same pattern as Meetings.
 * Each query must accept an ActorContext and filter on visibilityScope
 * (ORGANISATION / RESTRICTED / PRIVATE). See lib/meetings/queries.ts for
 * the full architecture description.
 *
 * TODO: add getInitiativeLinkOptions(actorContext) variant so that
 *   cross-module links in TargetLinkEditor can only point to initiatives
 *   visible to the current actor. Currently getMeetingLinkOptions() and
 *   getInitiativeLinkOptions() also return all records without visibility checks.
 */

import { prisma } from "@/lib/db/prisma";

// TODO: replace with visibility-filtered version (see file-level comment above).
// Until then, ALL initiatives are returned regardless of sensitivity.
export async function getInitiatives() {
  return prisma.initiative.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
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
    },
  });
}

// TODO: enforce visibility check — return null if actor cannot see this record
// (same 404-masking pattern as getMeetingBySlug to avoid information disclosure).
export async function getInitiativeBySlug(slug: string) {
  return prisma.initiative.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      status: true,
      owner: true,
      progress: true,
      dueDate: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getInitiativeById(id: string) {
  return prisma.initiative.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      status: true,
      owner: true,
      progress: true,
      dueDate: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
    },
  });
}

export type InitiativeListItem = Awaited<ReturnType<typeof getInitiatives>>[number];
export type InitiativeDetail = Awaited<ReturnType<typeof getInitiativeBySlug>>;
