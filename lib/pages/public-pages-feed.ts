/**
 * Public website pages feed for /api/public/v1/website/pages/[slug].
 *
 * Design invariants (mirrors public-news-feed.ts):
 * - Only PUBLISHED pages with a non-null publishedAt are returned.
 * - Internal fields (status, tenantId, reviewNotes, etc.) are never returned.
 * - Draft, In Review, Scheduled, and Archived pages are always hidden.
 * - All queries are tenant-scoped.
 */

import { prisma } from "@/lib/db/prisma";

// ── Public types ──────────────────────────────────────────────────────────────

export type PublicWebsitePageDetail = {
  id: string;
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date;
};

// ── Published-only where clause ───────────────────────────────────────────────

function publishedWhere(tenantId: string) {
  const now = new Date();
  return {
    tenantId,
    status: "PUBLISHED" as const,
    publishedAt: { not: null, lte: now },
  } as const;
}

// ── Detail query ──────────────────────────────────────────────────────────────

const publicPageDetailSelect = {
  id: true,
  slug: true,
  title: true,
  body: true,
  seoTitle: true,
  seoDescription: true,
  publishedAt: true,
} as const;

export type GetPublicWebsitePageBySlugInput = {
  tenantId: string;
  slug: string;
};

/**
 * Returns a single published website page by slug.
 * Returns null when not found, draft, in-review, scheduled, or archived.
 * Internal workflow fields are intentionally omitted.
 */
export async function getPublicWebsitePageBySlug(
  input: GetPublicWebsitePageBySlugInput,
): Promise<PublicWebsitePageDetail | null> {
  const row = await prisma.websitePage.findFirst({
    where: {
      ...publishedWhere(input.tenantId),
      slug: input.slug,
    },
    select: publicPageDetailSelect,
  });

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt!,
  };
}
