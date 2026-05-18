/**
 * Static stubs for Meetings and Initiatives used by the link editor.
 *
 * MEETINGS: The Meeting Prisma model now exists (migration 20260518150000).
 * TODO: Replace MEETING_STUBS with a real async query helper, e.g.:
 *
 *   // lib/linking/stubs.ts (future server-only version)
 *   import { prisma } from "@/lib/db/prisma";
 *   export async function getMeetingStubs(): Promise<EntityRef[]> {
 *     const meetings = await prisma.meeting.findMany({
 *       orderBy: { meetingDate: "desc" },
 *       select: { slug: true, title: true },
 *     });
 *     return meetings.map(m => ({
 *       slug: m.slug,
 *       title: m.title,
 *       url: `/vereinsleitung/meetings/${m.slug}`,
 *     }));
 *   }
 *
 * The TargetLinkEditor will need to accept this as a prop (from the page
 * server component) rather than importing the constant directly, so that
 * the query happens server-side and the client receives a serialised array.
 *
 * INITIATIVES: Still mocked — no Initiative Prisma model yet.
 * TODO: Same pattern once Initiative is promoted to DB-backed.
 */

import type { EntityRef } from "./types";

export const MEETING_STUBS: EntityRef[] = [
  {
    slug: "vorstandssitzung-april",
    title: "Vorstandssitzung April",
    url: "/vereinsleitung/meetings/vorstandssitzung-april",
  },
  {
    slug: "trainer-rapport-rueckrunde",
    title: "Trainer-Rapport Rückrunde",
    url: "/vereinsleitung/meetings/trainer-rapport-rueckrunde",
  },
  {
    slug: "medienkoordination-saisonstart",
    title: "Medienkoordination Saisonstart",
    url: "/vereinsleitung/meetings/medienkoordination-saisonstart",
  },
];

export const INITIATIVE_STUBS: EntityRef[] = [
  {
    slug: "website-relaunch",
    title: "Website Relaunch",
    url: "/vereinsleitung/initiativen/website-relaunch",
  },
  {
    slug: "neues-clubhaus-konzept",
    title: "Neues Clubhaus Konzept",
    url: "/vereinsleitung/initiativen/neues-clubhaus-konzept",
  },
  {
    slug: "sponsorenlauf-2025",
    title: "Sponsorenlauf 2025",
    url: "/vereinsleitung/initiativen/sponsorenlauf-2025",
  },
];
