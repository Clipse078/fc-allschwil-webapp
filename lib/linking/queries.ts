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

/** All DB-registered meetings as link options, newest first. */
export async function getMeetingLinkOptions(): Promise<EntityRef[]> {
  const meetings = await prisma.meeting.findMany({
    orderBy: { meetingDate: "desc" },
    select: { slug: true, title: true },
  });
  return meetings.map((m) => ({
    slug: m.slug,
    title: m.title,
    url: `/vereinsleitung/meetings/${m.slug}`,
  }));
}

/** All DB-registered initiatives as link options, alphabetical by title. */
export async function getInitiativeLinkOptions(): Promise<EntityRef[]> {
  const initiatives = await prisma.initiative.findMany({
    orderBy: { title: "asc" },
    select: { slug: true, title: true },
  });
  return initiatives.map((i) => ({
    slug: i.slug,
    title: i.title,
    url: `/vereinsleitung/initiativen/${i.slug}`,
  }));
}
