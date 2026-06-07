/**
 * Homepage Blocks — Public website feed.
 *
 * Design invariants:
 * - Only PUBLISHED blocks with a non-null publishedAt are returned.
 * - Blocks are returned in sortOrder ascending.
 * - Internal fields (status, tenantId, reviewNotes, heroMediaId, etc.)
 *   are never returned. Only public-safe fields are exposed.
 * - Draft, In Review, Scheduled, and Archived blocks are always hidden.
 * - All queries are tenant-scoped.
 */

import { prisma } from "@/lib/db/prisma";

// ── Public types ───────────────────────────────────────────────────────────────

export type PublicBlockStyling = {
  overlayColor: string | null;
  overlayOpacity: number | null;
  gradientType: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  textColor: string | null;
};

export type PublicHeroBlockData = {
  headline: string;
  subheadline: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type PublicHeroBlock = {
  id: string;
  type: "HERO";
  sortOrder: number;
  data: PublicHeroBlockData;
  backgroundImage: { url: string; altText: string | null } | null;
  styling: PublicBlockStyling;
  publishedAt: Date;
};

export type PublicHomepageBlock = PublicHeroBlock;

// ── Published-only where clause ───────────────────────────────────────────────

function publishedWhere(tenantId: string) {
  const now = new Date();
  return {
    tenantId,
    status: "PUBLISHED" as const,
    publishedAt: { not: null, lte: now },
  } as const;
}

// ── Query ──────────────────────────────────────────────────────────────────────

const publicBlockSelect = {
  id: true,
  type: true,
  sortOrder: true,
  data: true,
  heroMedia: {
    select: {
      url: true,
      altText: true,
    },
  },
  overlayColor: true,
  overlayOpacity: true,
  gradientType: true,
  gradientFrom: true,
  gradientTo: true,
  textColor: true,
  publishedAt: true,
} as const;

type RawPublicBlock = {
  id: string;
  type: string;
  sortOrder: number;
  data: unknown;
  heroMedia: { url: string; altText: string | null } | null;
  overlayColor: string | null;
  overlayOpacity: number | null;
  gradientType: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  textColor: string | null;
  publishedAt: Date | null;
};

function mapToPublicBlock(row: RawPublicBlock): PublicHomepageBlock {
  const rawData = (row.data ?? {}) as Record<string, unknown>;

  const heroData: PublicHeroBlockData = {
    headline: typeof rawData.headline === "string" ? rawData.headline : "",
    subheadline: typeof rawData.subheadline === "string" ? rawData.subheadline : null,
    ctaLabel: typeof rawData.ctaLabel === "string" ? rawData.ctaLabel : null,
    ctaUrl: typeof rawData.ctaUrl === "string" ? rawData.ctaUrl : null,
  };

  return {
    id: row.id,
    type: "HERO",
    sortOrder: row.sortOrder,
    data: heroData,
    backgroundImage: row.heroMedia
      ? { url: row.heroMedia.url, altText: row.heroMedia.altText }
      : null,
    styling: {
      overlayColor: row.overlayColor,
      overlayOpacity: row.overlayOpacity,
      gradientType: row.gradientType,
      gradientFrom: row.gradientFrom,
      gradientTo: row.gradientTo,
      textColor: row.textColor,
    },
    publishedAt: row.publishedAt!,
  };
}

export async function getPublicHomepageBlocks(
  tenantId: string,
): Promise<PublicHomepageBlock[]> {
  const rows = await prisma.homepageBlock.findMany({
    where: publishedWhere(tenantId),
    orderBy: { sortOrder: "asc" },
    select: publicBlockSelect,
  });

  return (rows as unknown as RawPublicBlock[]).map(mapToPublicBlock);
}
