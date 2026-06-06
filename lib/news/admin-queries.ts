/**
 * News CMS V2.1 — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * Complements lib/news/public-news-feed.ts (public-read-only, published-only).
 * This file exposes full CRUD for all statuses (DRAFT, SCHEDULED, PUBLISHED, ARCHIVED).
 *
 * V2.1 additions:
 *   - galleryMedia: ordered NewsArticleMedia items for the article gallery
 *   - reviewStage / reviewNotes: editorial review workflow
 *   - scheduledAt: auto-transitions status to SCHEDULED when set to future date
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArticleStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type ArticleReviewStage = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PUBLISHED";

export type NewsArticleHeroMediaSnippet = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

export type NewsArticleGalleryItem = {
  id: string;
  mediaAssetId: string;
  caption: string | null;
  orderIndex: number;
  mediaAsset: {
    id: string;
    url: string;
    altText: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    type: string;
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
  channels: unknown;
  tags: unknown;
  heroMediaId: string | null;
  reviewStage: ArticleReviewStage;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  heroMedia: NewsArticleHeroMediaSnippet;
};

export type NewsArticleAdminDetail = NewsArticleAdminListItem & {
  content: string;
  galleryMedia: NewsArticleGalleryItem[];
};

// ── Select shapes ─────────────────────────────────────────────────────────────

const heroMediaSelect = {
  id: true,
  url: true,
  altText: true,
  filename: true,
} as const;

const galleryMediaAssetSelect = {
  id: true,
  url: true,
  altText: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  type: true,
} as const;

const galleryMediaSelect = {
  id: true,
  mediaAssetId: true,
  caption: true,
  orderIndex: true,
  mediaAsset: { select: galleryMediaAssetSelect },
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
  channels: true,
  tags: true,
  heroMediaId: true,
  reviewStage: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
  heroMedia: { select: heroMediaSelect },
} as const;

const adminDetailSelect = {
  ...adminListSelect,
  content: true,
  galleryMedia: {
    select: galleryMediaSelect,
    orderBy: { orderIndex: "asc" as const },
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
  return row as unknown as NewsArticleAdminDetail;
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
  return row as unknown as NewsArticleAdminDetail;
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
  imageUrl?: string | null;
  heroMediaId?: string | null;
  channels?: string[] | null;
  scheduledAt?: Date | null;
  authorName?: string | null;
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
    imageUrl: input.imageUrl ?? null,
    heroMediaId: input.heroMediaId ?? null,
    channels: input.channels ?? null,
    scheduledAt: input.scheduledAt ?? null,
    authorName: input.authorName ?? null,
    tags: input.tags ?? null,
    status: deriveStatusFromScheduledAt(input.scheduledAt, "DRAFT"),
    reviewStage: "DRAFT",
  };

  const row = await prisma.newsArticle.create({ data, select: adminDetailSelect });
  return row as unknown as NewsArticleAdminDetail;
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateNewsArticleInput = {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: string;
  imageUrl?: string | null;
  heroMediaId?: string | null;
  channels?: string[] | null;
  scheduledAt?: Date | null;
  authorName?: string | null;
  tags?: string[] | null;
  reviewStage?: ArticleReviewStage;
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
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.heroMediaId !== undefined) {
    data.heroMedia = input.heroMediaId
      ? { connect: { id: input.heroMediaId } }
      : { disconnect: true };
  }
  if (input.channels !== undefined) data.channels = input.channels ?? null;
  if (input.authorName !== undefined) data.authorName = input.authorName;
  if (input.tags !== undefined) data.tags = input.tags ?? null;
  if (input.reviewStage !== undefined) data.reviewStage = input.reviewStage;
  if (input.reviewNotes !== undefined) data.reviewNotes = input.reviewNotes;

  // scheduledAt drives status auto-transition for DRAFT/SCHEDULED articles
  if (input.scheduledAt !== undefined) {
    data.scheduledAt = input.scheduledAt;
    const currentStatus = existing.status as ArticleStatus;
    if (currentStatus === "DRAFT" || currentStatus === "SCHEDULED") {
      data.status = deriveStatusFromScheduledAt(input.scheduledAt, currentStatus);
    }
  }

  const row = await prisma.newsArticle.update({
    where: { id },
    data,
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
}

// ── Publish / Unpublish / Archive ─────────────────────────────────────────────

export async function publishNewsArticle(
  tenantId: string,
  id: string,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      reviewStage: "PUBLISHED",
      ...(existing.status !== "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
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
    data: { status: "DRAFT", reviewStage: "DRAFT" },
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
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
    select: { id: true, reviewStage: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: { reviewStage: "SUBMITTED" },
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
}

export async function approveNewsArticle(
  tenantId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      reviewStage: "APPROVED",
      ...(reviewNotes !== undefined ? { reviewNotes } : {}),
    },
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
}

export async function rejectNewsArticle(
  tenantId: string,
  id: string,
  reviewNotes?: string | null,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.newsArticle.update({
    where: { id },
    data: {
      reviewStage: "REJECTED",
      ...(reviewNotes !== undefined ? { reviewNotes } : {}),
    },
    select: adminDetailSelect,
  });
  return row as unknown as NewsArticleAdminDetail;
}

// ── Gallery CRUD ──────────────────────────────────────────────────────────────

export async function addGalleryItem(
  tenantId: string,
  newsArticleId: string,
  mediaAssetId: string,
  caption?: string | null,
): Promise<NewsArticleGalleryItem | null> {
  // Verify article belongs to tenant
  const article = await prisma.newsArticle.findFirst({
    where: { id: newsArticleId, tenantId },
    select: { id: true },
  });
  if (!article) return null;

  // Verify media asset belongs to tenant
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, tenantId },
    select: { id: true },
  });
  if (!asset) return null;

  // Determine next orderIndex
  const maxOrder = await prisma.newsArticleMedia.aggregate({
    where: { newsArticleId },
    _max: { orderIndex: true },
  });
  const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1;

  const item = await prisma.newsArticleMedia.upsert({
    where: { newsArticleId_mediaAssetId: { newsArticleId, mediaAssetId } },
    create: { newsArticleId, mediaAssetId, caption: caption ?? null, orderIndex: nextOrder },
    update: { caption: caption ?? null },
    select: galleryMediaSelect,
  });

  return item as unknown as NewsArticleGalleryItem;
}

export async function updateGalleryItemCaption(
  tenantId: string,
  newsArticleId: string,
  galleryItemId: string,
  caption: string | null,
): Promise<boolean> {
  const article = await prisma.newsArticle.findFirst({
    where: { id: newsArticleId, tenantId },
    select: { id: true },
  });
  if (!article) return false;

  await prisma.newsArticleMedia.updateMany({
    where: { id: galleryItemId, newsArticleId },
    data: { caption },
  });
  return true;
}

export async function removeGalleryItem(
  tenantId: string,
  newsArticleId: string,
  galleryItemId: string,
): Promise<boolean> {
  const article = await prisma.newsArticle.findFirst({
    where: { id: newsArticleId, tenantId },
    select: { id: true },
  });
  if (!article) return false;

  await prisma.newsArticleMedia.deleteMany({
    where: { id: galleryItemId, newsArticleId },
  });
  return true;
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

// ── Internal helpers ──────────────────────────────────────────────────────────

function deriveStatusFromScheduledAt(
  scheduledAt: Date | null | undefined,
  currentStatus: ArticleStatus,
): ArticleStatus {
  if (scheduledAt && scheduledAt > new Date()) return "SCHEDULED";
  if (!scheduledAt && currentStatus === "SCHEDULED") return "DRAFT";
  return currentStatus;
}
