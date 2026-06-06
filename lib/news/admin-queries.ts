/**
 * News CMS V2 — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * Complements lib/news/public-news-feed.ts (public-read-only, published-only).
 * This file exposes full CRUD for all statuses (DRAFT, SCHEDULED, PUBLISHED, ARCHIVED).
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArticleStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export type NewsArticleHeroMediaSnippet = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

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
  createdAt: Date;
  updatedAt: Date;
  heroMedia: NewsArticleHeroMediaSnippet;
};

export type NewsArticleAdminDetail = NewsArticleAdminListItem & {
  content: string;
};

// ── Select shapes ─────────────────────────────────────────────────────────────

const heroMediaSelect = {
  id: true,
  url: true,
  altText: true,
  filename: true,
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
  createdAt: true,
  updatedAt: true,
  heroMedia: { select: heroMediaSelect },
} as const;

const adminDetailSelect = {
  ...adminListSelect,
  content: true,
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
    status: "DRAFT",
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
};

export async function updateNewsArticle(
  tenantId: string,
  id: string,
  input: UpdateNewsArticleInput,
): Promise<NewsArticleAdminDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  // Build data object carefully to avoid Prisma relation/FK type conflicts.
  // heroMedia is updated via relation (connect/disconnect) not FK field.
  // JSON fields (channels, tags) cast via `never` to satisfy Prisma's InputJsonValue.
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
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.authorName !== undefined) data.authorName = input.authorName;
  if (input.tags !== undefined) data.tags = input.tags ?? null;

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
    data: { status: "DRAFT" },
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
