/**
 * News CMS — Admin query layer.
 *
 * Tenant-scoped CRUD queries for the news admin UI.
 * Separate from public-news-feed.ts to keep public/admin concerns isolated.
 *
 * Design:
 * - All queries require tenantId to enforce tenant isolation.
 * - Returns internal fields (status, createdAt, updatedAt) unlike public feed.
 * - Joins heroMedia for the editor's hero image picker.
 */

import { prisma } from "@/lib/db/prisma";
import type { NewsArticleStatus } from "@prisma/client";

// ── Select shapes ─────────────────────────────────────────────────────────────

const heroMediaSelect = {
  id: true,
  name: true,
  altText: true,
  storagePath: true,
  focalX: true,
  focalY: true,
  mimeType: true,
} as const;

const articleListSelect = {
  id: true,
  tenantId: true,
  slug: true,
  title: true,
  excerpt: true,
  imageUrl: true,
  status: true,
  publishedAt: true,
  authorName: true,
  channels: true,
  createdAt: true,
  updatedAt: true,
  heroMedia: { select: heroMediaSelect },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

const articleDetailSelect = {
  ...articleListSelect,
  content: true,
  heroMediaId: true,
  contentBlocks: {
    select: {
      id: true,
      sortOrder: true,
      type: true,
      data: true,
      mediaId: true,
      createdAt: true,
      media: { select: heroMediaSelect },
    },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export type AdminNewsArticleListItem = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  status: NewsArticleStatus;
  publishedAt: Date | null;
  authorName: string | null;
  channels: unknown;
  createdAt: Date;
  updatedAt: Date;
  heroMedia: {
    id: string;
    name: string;
    altText: string | null;
    storagePath: string;
    focalX: number | null;
    focalY: number | null;
    mimeType: string;
  } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
};

export type AdminNewsArticleDetail = AdminNewsArticleListItem & {
  content: string;
  heroMediaId: string | null;
  contentBlocks: Array<{
    id: string;
    sortOrder: number;
    type: string;
    data: unknown;
    mediaId: string | null;
    createdAt: Date;
    media: {
      id: string;
      name: string;
      altText: string | null;
      storagePath: string;
      focalX: number | null;
      focalY: number | null;
      mimeType: string;
    } | null;
  }>;
};

// ── List ──────────────────────────────────────────────────────────────────────

export type ListAdminArticlesInput = {
  tenantId: string;
  status?: NewsArticleStatus | null;
  limit?: number;
  offset?: number;
};

export async function listAdminNewsArticles(
  input: ListAdminArticlesInput,
): Promise<{ articles: AdminNewsArticleListItem[]; total: number }> {
  const where = {
    tenantId: input.tenantId,
    ...(input.status ? { status: input.status } : {}),
  };

  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const [articles, total] = await prisma.$transaction([
    prisma.newsArticle.findMany({
      where,
      select: articleListSelect,
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return { articles: articles as AdminNewsArticleListItem[], total };
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getAdminNewsArticleById(
  id: string,
  tenantId: string,
): Promise<AdminNewsArticleDetail | null> {
  const article = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: articleDetailSelect,
  });
  return (article as AdminNewsArticleDetail | null) ?? null;
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
  authorName?: string | null;
  channels?: string[] | null;
  createdById?: string | null;
};

export async function createNewsArticle(
  input: CreateNewsArticleInput,
): Promise<AdminNewsArticleDetail> {
  const article = await prisma.newsArticle.create({
    data: {
      tenantId: input.tenantId,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content,
      imageUrl: input.imageUrl ?? null,
      heroMediaId: input.heroMediaId ?? null,
      authorName: input.authorName ?? null,
      channels: input.channels ? JSON.parse(JSON.stringify(input.channels)) : null,
      createdById: input.createdById ?? null,
      status: "DRAFT",
    },
    select: articleDetailSelect,
  });
  return article as AdminNewsArticleDetail;
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateNewsArticleInput = {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: string;
  imageUrl?: string | null;
  heroMediaId?: string | null;
  authorName?: string | null;
  channels?: string[] | null;
  status?: NewsArticleStatus;
  publishedAt?: Date | null;
};

export async function updateNewsArticle(
  id: string,
  tenantId: string,
  input: UpdateNewsArticleInput,
): Promise<AdminNewsArticleDetail | null> {
  const existing = await prisma.newsArticle.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const article = await prisma.newsArticle.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.heroMediaId !== undefined ? { heroMediaId: input.heroMediaId } : {}),
      ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
      ...(input.channels !== undefined
        ? { channels: input.channels ? JSON.parse(JSON.stringify(input.channels)) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
    },
    select: articleDetailSelect,
  });
  return article as AdminNewsArticleDetail;
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishNewsArticle(
  id: string,
  tenantId: string,
): Promise<AdminNewsArticleDetail | null> {
  const existing = await prisma.newsArticle.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const heroMedia = existing.heroMediaId
    ? await prisma.mediaAsset.findUnique({
        where: { id: existing.heroMediaId },
        select: { storagePath: true },
      })
    : null;

  const article = await prisma.newsArticle.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: existing.publishedAt ?? new Date(),
      // Keep imageUrl in sync with heroMedia.storagePath for backward compat
      ...(heroMedia ? { imageUrl: heroMedia.storagePath } : {}),
    },
    select: articleDetailSelect,
  });
  return article as AdminNewsArticleDetail;
}

// ── Archive ───────────────────────────────────────────────────────────────────

export async function archiveNewsArticle(
  id: string,
  tenantId: string,
): Promise<AdminNewsArticleDetail | null> {
  const existing = await prisma.newsArticle.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const article = await prisma.newsArticle.update({
    where: { id },
    data: { status: "ARCHIVED" },
    select: articleDetailSelect,
  });
  return article as AdminNewsArticleDetail;
}

// ── Slug check ────────────────────────────────────────────────────────────────

export async function isSlugAvailable(
  tenantId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.newsArticle.findFirst({
    where: {
      tenantId,
      slug,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

// ── Generate slug ─────────────────────────────────────────────────────────────

/**
 * Converts a title to a URL-safe slug.
 * Example: "Saisonstart 2026 — Willkommen!" → "saisonstart-2026-willkommen"
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" }[c] ?? c))
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
