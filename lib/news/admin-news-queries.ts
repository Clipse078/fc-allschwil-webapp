/**
 * Admin news queries — authenticated, tenant-scoped CRUD for the CMS.
 *
 * All functions require a tenantId resolved from the session.
 * They never expose internal fields on public surfaces.
 *
 * Public feed queries live in lib/news/public-news-feed.ts and are
 * intentionally kept separate (different field selection, published-only).
 */

import { prisma } from "@/lib/db/prisma";
import type { NewsArticleStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminNewsArticleListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  authorName: string | null;
  status: NewsArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminNewsArticleDetail = AdminNewsArticleListItem & {
  content: string;
};

export type CreateNewsArticleInput = {
  tenantId: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  imageUrl?: string | null;
  authorName?: string | null;
  status?: NewsArticleStatus;
  publishedAt?: Date | null;
};

export type UpdateNewsArticleInput = Partial<Omit<CreateNewsArticleInput, "tenantId">>;

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

const adminListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  imageUrl: true,
  authorName: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const adminDetailSelect = {
  ...adminListSelect,
  content: true,
} as const;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type ListNewsArticlesInput = {
  tenantId: string;
  status?: NewsArticleStatus | null;
};

export async function listNewsArticles(
  input: ListNewsArticlesInput,
): Promise<AdminNewsArticleListItem[]> {
  return prisma.newsArticle.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: adminListSelect,
  });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getNewsArticleById(
  tenantId: string,
  articleId: string,
): Promise<AdminNewsArticleDetail | null> {
  return prisma.newsArticle.findFirst({
    where: { id: articleId, tenantId },
    select: adminDetailSelect,
  });
}

export async function getNewsArticleBySlug(
  tenantId: string,
  slug: string,
): Promise<AdminNewsArticleDetail | null> {
  return prisma.newsArticle.findFirst({
    where: { tenantId, slug },
    select: adminDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createNewsArticle(
  input: CreateNewsArticleInput,
): Promise<AdminNewsArticleDetail> {
  return prisma.newsArticle.create({
    data: {
      tenantId: input.tenantId,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      content: input.content,
      imageUrl: input.imageUrl ?? null,
      authorName: input.authorName ?? null,
      status: input.status ?? "DRAFT",
      publishedAt: input.publishedAt ?? null,
    },
    select: adminDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateNewsArticle(
  tenantId: string,
  articleId: string,
  input: UpdateNewsArticleInput,
): Promise<AdminNewsArticleDetail | null> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id: articleId, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.newsArticle.update({
    where: { id: articleId },
    data: {
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
      ...(input.content !== undefined && { content: input.content }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.authorName !== undefined && { authorName: input.authorName }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
    },
    select: adminDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Delete (hard delete — used only from admin; soft status is ARCHIVED)
// ---------------------------------------------------------------------------

export async function deleteNewsArticle(
  tenantId: string,
  articleId: string,
): Promise<boolean> {
  const existing = await prisma.newsArticle.findFirst({
    where: { id: articleId, tenantId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.newsArticle.delete({ where: { id: articleId } });
  return true;
}

// ---------------------------------------------------------------------------
// Slug uniqueness check (for form validation)
// ---------------------------------------------------------------------------

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
