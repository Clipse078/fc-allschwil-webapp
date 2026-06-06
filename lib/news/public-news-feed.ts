/**
 * Public news feed queries for /api/public/v1/website/news/*.
 *
 * Design invariants:
 * - Only PUBLISHED articles with a non-null publishedAt are returned.
 *   Articles with status SCHEDULED or a future scheduledAt are not exposed.
 * - List queries never select content/body (bandwidth + security).
 * - Detail query selects content/body but only for a single article.
 * - All queries are scoped to a tenantId to enforce tenant isolation.
 * - Internal fields (status, createdAt, updatedAt, tenantId) are never returned.
 * - Draft, In Review, and future-scheduled articles are always hidden.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  PublicNewsArticleListItem,
  PublicNewsArticleDetail,
} from "@/lib/website/types";

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

const publicArticleListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  imageUrl: true,
  publishedAt: true,
  heroMedia: {
    select: { id: true, url: true, altText: true, filename: true },
  },
} as const;

const publicArticleDetailSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  publishedAt: true,
  heroMedia: {
    select: { id: true, url: true, altText: true, filename: true },
  },
  additionalMedia: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      sortOrder: true,
      caption: true,
      placement: true,
      mediaAsset: {
        select: {
          id: true,
          url: true,
          filename: true,
          altText: true,
          type: true,
          mimeType: true,
          width: true,
          height: true,
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Published-only where clause
// ---------------------------------------------------------------------------

function publishedWhere(tenantId: string) {
  const now = new Date();
  return {
    tenantId,
    status: "PUBLISHED" as const,
    publishedAt: { not: null, lte: now },
  } as const;
}

// ---------------------------------------------------------------------------
// List query — no content
// ---------------------------------------------------------------------------

export type GetPublicNewsArticlesInput = {
  tenantId: string;
  limit?: number | null;
};

function normalizeLimit(value?: number | null) {
  if (!value || !Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(100, value));
}

/**
 * Returns published news articles for the list endpoint.
 * content/body is intentionally omitted. Hero media URL is included.
 */
export async function getPublicNewsArticles(
  input: GetPublicNewsArticlesInput
): Promise<PublicNewsArticleListItem[]> {
  const limit = normalizeLimit(input.limit);

  const rows = await prisma.newsArticle.findMany({
    where: publishedWhere(input.tenantId),
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
    take: limit,
    select: publicArticleListSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt!,
    heroMedia: row.heroMedia
      ? {
          id: row.heroMedia.id,
          url: row.heroMedia.url,
          altText: row.heroMedia.altText,
          filename: row.heroMedia.filename,
        }
      : null,
  }));
}

// ---------------------------------------------------------------------------
// Detail query — includes content, hero media, and additional media
// ---------------------------------------------------------------------------

export type GetPublicNewsArticleBySlugInput = {
  tenantId: string;
  slug: string;
};

/**
 * Returns a single published news article including content/body, hero media,
 * and additional gallery media. Returns null when not found, draft, or archived.
 */
export async function getPublicNewsArticleBySlug(
  input: GetPublicNewsArticleBySlugInput
): Promise<PublicNewsArticleDetail | null> {
  const row = await prisma.newsArticle.findFirst({
    where: {
      ...publishedWhere(input.tenantId),
      slug: input.slug,
    },
    select: publicArticleDetailSelect,
  });

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt!,
    heroMedia: row.heroMedia
      ? {
          id: row.heroMedia.id,
          url: row.heroMedia.url,
          altText: row.heroMedia.altText,
          filename: row.heroMedia.filename,
        }
      : null,
    additionalMedia: (row.additionalMedia ?? []).map((m) => ({
      id: m.id,
      sortOrder: m.sortOrder,
      caption: m.caption,
      placement: m.placement,
      mediaAsset: {
        id: m.mediaAsset.id,
        url: m.mediaAsset.url,
        filename: m.mediaAsset.filename,
        altText: m.mediaAsset.altText,
        type: m.mediaAsset.type,
        mimeType: m.mediaAsset.mimeType,
        width: m.mediaAsset.width,
        height: m.mediaAsset.height,
      },
    })),
  };
}
