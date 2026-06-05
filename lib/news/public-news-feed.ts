/**
 * Public news feed queries for /api/public/v1/website/news/*.
 *
 * Design invariants:
 * - Only PUBLISHED articles with a non-null publishedAt are returned.
 * - List queries never select content/body (bandwidth + security).
 * - Detail query selects content/body but only for a single article.
 * - All queries are scoped to a tenantId to enforce tenant isolation.
 * - Internal fields (status, createdAt, updatedAt, tenantId) are never returned.
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
} as const;

const publicArticleDetailSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  publishedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Published-only where clause
// ---------------------------------------------------------------------------

function publishedWhere(tenantId: string) {
  return {
    tenantId,
    status: "PUBLISHED" as const,
    publishedAt: { not: null },
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
 * content/body is intentionally omitted.
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
    ...row,
    publishedAt: row.publishedAt!,
  }));
}

// ---------------------------------------------------------------------------
// Detail query — includes content
// ---------------------------------------------------------------------------

export type GetPublicNewsArticleBySlugInput = {
  tenantId: string;
  slug: string;
};

/**
 * Returns a single published news article including content/body.
 * Returns null when the article is not found, is a draft, or is archived.
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
    ...row,
    publishedAt: row.publishedAt!,
  };
}
