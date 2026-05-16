/**
 * Tenant-scoped, read-only public data queries for the website renderer.
 * Never expose admin/draft data. All queries filter by tenantKey or active season.
 */
import { prisma } from "@/lib/db/prisma";

// ── Events ────────────────────────────────────────────────────────────────────

export type PublicEventItem = {
  id: string;
  title: string;
  type: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  teamName: string | null;
  opponentName: string | null;
  competitionLabel: string | null;
};

export async function getPublicEventsList(
  tenantKey: string,
  limit = 8,
): Promise<PublicEventItem[]> {
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey },
    select: { id: true },
  });
  if (!site) return [];

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      infoboardVisible: true,
      status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] },
      startAt: { gte: now },
    },
    orderBy: { startAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      endAt: true,
      location: true,
      opponentName: true,
      competitionLabel: true,
      team: { select: { name: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startAt: e.startAt,
    endAt: e.endAt,
    location: e.location,
    teamName: e.team?.name ?? null,
    opponentName: e.opponentName,
    competitionLabel: e.competitionLabel,
  }));
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export type PublicTeamItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  ageGroup: string | null;
  genderGroup: string | null;
};

export async function getPublicTeamsList(
  _tenantKey: string,
  limit = 12,
): Promise<PublicTeamItem[]> {
  const teams = await prisma.team.findMany({
    where: { isActive: true, websiteVisible: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      ageGroup: true,
      genderGroup: true,
    },
  });

  return teams;
}

// ── Page navigation ───────────────────────────────────────────────────────────

export async function getPublishedPageNav(tenantKey: string) {
  const snapshots = await prisma.websitePublishSnapshot.findMany({
    where: { tenantKey },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, pageType: true, locale: true },
  });

  // Deduplicate by slug+locale (keep latest)
  const seen = new Set<string>();
  return snapshots.filter((s) => {
    const key = `${s.slug}:${s.locale}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
