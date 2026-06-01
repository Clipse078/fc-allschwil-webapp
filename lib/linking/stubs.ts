/**
 * Legacy static stubs — kept for reference and seed fallback only.
 *
 * MEETINGS and INITIATIVES are now DB-backed. The TargetLinkEditor and
 * validateLinkPayload no longer import these constants. Link options are
 * fetched server-side via lib/linking/queries.ts (getMeetingLinkOptions /
 * getInitiativeLinkOptions) and passed as props to the editor.
 *
 * These stubs remain in place so that any external scripts or tests that
 * reference the known legacy slugs still compile without change.
 * They may be deleted once all callers are confirmed migrated.
 *
 * MEETINGS: The Meeting Prisma model now exists (migration 20260518150000).
 * ✅ getMeetingLinkOptions() in lib/linking/queries.ts replaces this stub.
 * Historical note — was replaced by a real async query helper, e.g.:
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
 * INITIATIVES: The Initiative Prisma model now exists (migration 20260518160000).
 * ✅ getInitiativeLinkOptions() in lib/linking/queries.ts replaces this stub.
 * Historical note — was replaced by a real async query helper, e.g.:
 *
 *   export async function getInitiativeStubs(): Promise<EntityRef[]> {
 *     const initiatives = await prisma.initiative.findMany({
 *       orderBy: [{ status: "asc" }, { createdAt: "desc" }],
 *       select: { slug: true, title: true },
 *     });
 *     return initiatives.map(i => ({
 *       slug: i.slug,
 *       title: i.title,
 *       url: `/vereinsleitung/initiativen/${i.slug}`,
 *     }));
 *   }
 *
 * As with getMeetingStubs(), pass the result as a prop from the server page
 * to TargetLinkEditor rather than importing the constant directly.
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
