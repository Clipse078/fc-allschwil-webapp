/**
 * Static stubs for Meetings and Initiatives.
 *
 * These replace the mocked arrays embedded in UI components so that:
 * 1. Link editors can reference available entities from a shared source.
 * 2. When Meeting/Initiative are promoted to DB-backed models, this file
 *    is replaced by real DB queries — all consumers update automatically.
 *
 * TODO: Replace with DB queries once Meeting/Initiative models exist:
 *   const meetings = await prisma.meeting.findMany({ select: { slug, title } });
 *   const initiatives = await prisma.initiative.findMany({ select: { slug, title } });
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
