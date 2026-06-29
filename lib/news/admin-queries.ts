/**
 * News CMS V2.1 — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * Complements lib/news/public-news-feed.ts (public-read-only, published-only).
 * This file exposes full CRUD for all statuses.
 */

import { prisma } from "@/lib/db/prisma";
import { isRichTextValue, type RichTextValue } from "@/lib/cms/rich-text";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArticleStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";

export type NewsArticleHeroMediaSnippet = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

export type NewsArticleAuthorPersonSnippet = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
} | null;

export type NewsArticleMediaItem = {
  id: string;
  mediaAssetId: string;
  sortOrder: number;
  caption: string | null;
  placement: string | null;
  mediaAsset: {
    id: string;
    url: string;
    filename: string;
    altText: string | null;
    type: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  };
};

export type NewsArticleAdminListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  status: ArticleStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  authorName: string | null;
  authorPersonId: string | null;
  channels: unknown;
  tags: unknown;
  heroMediaId: string | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  heroMedia: NewsArticleHeroMediaSnippet;
  authorPerson: NewsArticleAuthorPersonSnippet;
};

export type NewsArticleAdminDetail = NewsArticleAdminListItem & {
  content: string;
  /**
   * Structured TipTap/ProseMirror JSON from the shared RichTextEditor.
   * Null for legacy articles or when contentJson has not been set.
   * Validated against RichTextValue shape on the way out of every query
   * so it is safe to pass across the RSC server→client boundary.
   */
  contentJson: RichTextValue | null;
  additionalMedia: NewsArticleMediaItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Coerces the raw Prisma Json? field value to RichTextValue | null.
 *
 * Prisma can return several non-plain-object representations for nullable
 * JSON columns (e.g. Prisma.JsonNull, Prisma.DbNull, raw tagged objects).
 * Those values are NOT serialisable across the RSC server→client boundary
 * and will cause Next.js to throw "Classes or null prototypes are not
 * supported" at the RSC serialisation step.
 *
 * Running the value through isRichTextValue() ensures:
 *  - SQL-NULL or any non-doc value  → returns JavaScript null (serialisable)
 *  - Valid { type:"doc", content:[] } → returns the object as RichTextValue
 */
function sanitizeContentJson(raw: unknown): RichTextValue | null {
  return isRichTextValue(raw) ? (raw as RichTextValue) : null;
}

// ── Select shapes ─────────────────────────────────────────────────────────────

const heroMediaSelect = {
  id: true,
  url: true,
  altText: true,
  filename: true,
} as const;

const authorPersonSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} as const;

const additionalMediaSelect = {
  id: true,
  mediaAssetId: true,
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
} as const;

const adminListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  imageUrl: true,
  status: true,
  publishedAt: true,
  scheduledAt: true,
  authorName: true,
  authorPersonId: true,
  channels: true,
  tags: true,
  heroMediaId: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
  heroMedia: { select: heroMediaSelect },
  authorPerson: { select: authorPersonSelect },
} as const;

const adminDetailSelect = {
  ...adminListSelect,
  content: true,
  contentJson: true,
  additionalMedia: {
    select: additionalMediaSelect,
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

// ── List ──────────────────────────────────────────────────────────────────────

export type ListNewsArticlesInput = {
  tenantId: string;
  status?: ArticleStatus;
  limit?: number;
  offset?: number;
};

export async function listNewsArticlesAdmin(
  input: ListNewsArticlesInput,
): Promise<NewsArticleAdminListItem[]> {
  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const rows = await prisma.newsArticle.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    skip: offset,
    select: adminListSelect,
  });

  return rows as unknown as NewsArticleAdminListItem[];
}

export async function countNewsArticlesAdmin(
  tenantId: string,
  status?: ArticleStatus,
): Promise<number> {
  return prisma.newsArticle.count({
    where: { tenantId, ...(status ? { status } : {}) },
  });
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getNewsArticleAdminById(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const row = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: adminDetailSelect,
  });
  if (!row) return null;
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

export async function getNewsArticleAdminBySlug(
  tenantId: string,
  slug: string,
): Promise<NewsArticleAdminDetail | null> {
  const row = await prisma.newsArticle.findFirst({
    where: { tenantId, slug },
    select: adminDetailSelect,
  });
  if (!row) return null;
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

// ── Slug availability ─────────────────────────────────────────────────────────

export async function isSlugAvailable(
  tenantId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.newsArticle.findFirst({
    where: {
      tenantId,
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateNewsArticleInput = {
  tenantId: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  /** Structured TipTap/ProseMirror JSON. When provided, stored alongside content for rich rendering. */
  contentJson?: unknown;
  imageUrl?: string | null;
  heroMediaId?: string | null;
  channels?: string[] | null;
  scheduledAt?: Date | null;
  authorName?: string | null;
  authorPersonId?: string | null;
  tags?: string[] | null;
};

export async function createNewsArticle(
  input: CreateNewsArticleInput,
): Promise<NewsArticleAdminDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    tenantId: input.tenantId,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt ?? null,
    content: input.content,
    contentJson: input.contentJson ?? null,
    imageUrl: input.imageUrl ?? null,
    heroMediaId: input.heroMediaId ?? null,
    channels: input.channels ?? null,
    scheduledAt: input.scheduledAt ?? null,
    authorName: input.authorName ?? null,
    authorPersonId: input.authorPersonId ?? null,
    tags: input.tags ?? null,
    status: "DRAFT",
  };

  const row = await prisma.newsArticle.create({ data, select: adminDetailSelect });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateNewsArticleInput = {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: string;
  /** Structured TipTap/ProseMirror JSON. When provided, stored alongside content for rich rendering. */
  contentJson?: unknown;
  imageUrl?: string | null;
  heroMediaId?: string | null;
  channels?: string[] | null;
  scheduledAt?: Date | null;
  authorName?: string | null;
  authorPersonId?: string | null;
  tags?: string[] | null;
  reviewNotes?: string | null;
};

export async function updateNewsArticle(
  tenantId: string,
  id: string,
  input: UpdateNewsArticleInput,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (input.slug !== undefined) data.slug = input.slug;
  if (input.title !== undefined) data.title = input.title;
  if (input.excerpt !== undefined) data.excerpt = input.excerpt;
  if (input.content !== undefined) data.content = input.content;
  if (input.contentJson !== undefined) data.contentJson = input.contentJson ?? null;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.heroMediaId !== undefined) {
    data.heroMedia = input.heroMediaId
      ? { connect: { id: input.heroMediaId } }
      : { disconnect: true };
  }
  if (input.channels !== undefined) data.channels = input.channels ?? null;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.authorName !== undefined) data.authorName = input.authorName;
  if (input.authorPersonId !== undefined) {
    data.authorPerson = input.authorPersonId
      ? { connect: { id: input.authorPersonId } }
      : { disconnect: true };
  }
  if (input.tags !== undefined) data.tags = input.tags ?? null;
  if (input.reviewNotes !== undefined) data.reviewNotes = input.reviewNotes;

  // Auto-transition DRAFT → SCHEDULED when a future scheduledAt is set
  const effectiveScheduledAt =
    input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt;
  if (
    effectiveScheduledAt &&
    effectiveScheduledAt > new Date() &&
    (existing.status === "DRAFT" || existing.status === "IN_REVIEW")
  ) {
    data.status = "SCHEDULED";
  }
  // Clear SCHEDULED back to DRAFT if scheduledAt is removed
  if (
    input.scheduledAt === null &&
    existing.status === "SCHEDULED"
  ) {
    data.status = "DRAFT";
  }

  const row = await prisma.newsArticle.update({
    where: { id },
    data,
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

// ── Publish / Unpublish / Archive ─────────────────────────────────────────────

export async function publishNewsArticle(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  // If scheduledAt is in the future, set status to SCHEDULED instead of PUBLISHED
  const now = new Date();
  const isScheduledForFuture =
    existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      ...(existing.status !== "PUBLISHED" && !isScheduledForFuture
        ? { publishedAt: now }
        : {}),
    },
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

export async function unpublishNewsArticle(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: { status: "DRAFT" },
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

export async function archiveNewsArticle(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.newsArticle.update({ where: { id }, data: { status: "ARCHIVED" } });
  return true;
}

// ── Review workflow ───────────────────────────────────────────────────────────

export async function submitNewsArticleForReview(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (!["DRAFT", "ARCHIVED"].includes(existing.status)) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: { status: "IN_REVIEW", reviewNotes: null },
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

export async function approveNewsArticle(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isScheduledForFuture =
    existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      reviewNotes: null,
      ...(!isScheduledForFuture ? { publishedAt: now } : {}),
    },
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

export async function rejectNewsArticle(
  tenantId: string,
  id: string,
  notes?: string | null,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      status: "DRAFT",
      reviewNotes: notes ?? null,
    },
    select: adminDetailSelect,
  });
  return {
    ...(row as unknown as NewsArticleAdminDetail),
    contentJson: sanitizeContentJson(row.contentJson),
  };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteNewsArticle(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.newsArticle.delete({ where: { id } });
  return true;
}

// ── Article media (additional media, not hero) ────────────────────────────────

export type AddArticleMediaInput = {
  tenantId: string;
  articleId: string;
  mediaAssetId: string;
  sortOrder?: number;
  caption?: string | null;
  placement?: string | null;
};

export async function addArticleMedia(
  input: AddArticleMediaInput,
): Promise<NewsArticleMediaItem | null> {
  // Verify article belongs to tenant
  const article = await prisma.newsArticle.findFirst({
    where: { id: input.articleId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!article) return null;

  // Verify media asset belongs to tenant
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: input.mediaAssetId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!asset) return null;

  // Determine sortOrder if not specified (append at end)
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.newsArticleMedia.findFirst({
      where: { articleId: input.articleId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const row = await prisma.newsArticleMedia.upsert({
    where: {
      articleId_mediaAssetId: {
        articleId: input.articleId,
        mediaAssetId: input.mediaAssetId,
      },
    },
    create: {
      tenantId: input.tenantId,
      articleId: input.articleId,
      mediaAssetId: input.mediaAssetId,
      sortOrder,
      caption: input.caption ?? null,
      placement: input.placement ?? null,
    },
    update: {
      sortOrder,
      caption: input.caption ?? null,
      placement: input.placement ?? null,
    },
    select: additionalMediaSelect,
  });

  return row as unknown as NewsArticleMediaItem;
}

export async function removeArticleMedia(
  tenantId: string,
  articleId: string,
  mediaAssetId: string,
): Promise<boolean> {
  const existing = await prisma.newsArticleMedia.findFirst({
    where: { articleId, mediaAssetId, tenantId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.newsArticleMedia.delete({ where: { id: existing.id } });
  return true;
}

export async function reorderArticleMedia(
  tenantId: string,
  articleId: string,
  orderedMediaAssetIds: string[],
): Promise<void> {
  // Verify article belongs to tenant
  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, tenantId },
    select: { id: true },
  });
  if (!article) return;

  await Promise.all(
    orderedMediaAssetIds.map((mediaAssetId, idx) =>
      prisma.newsArticleMedia.updateMany({
        where: { articleId, mediaAssetId, tenantId },
        data: { sortOrder: idx },
      }),
    ),
  );
}

export async function listArticleMedia(
  tenantId: string,
  articleId: string,
): Promise<NewsArticleMediaItem[]> {
  const rows = await prisma.newsArticleMedia.findMany({
    where: { articleId, tenantId },
    orderBy: { sortOrder: "asc" },
    select: additionalMediaSelect,
  });
  return rows as unknown as NewsArticleMediaItem[];
}

// ── Slug generation helper ────────────────────────────────────────────────────

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "artikel"
  );
}
