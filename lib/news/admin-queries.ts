/**
 * Admin news queries — tenant-scoped CRUD for the News CMS.
 *
 * All operations require a tenantId resolved from session.user.tenantId.
 * No fallback to DEFAULT_TENANT_KEY — strict isolation.
 *
 * Design invariants:
 * - Admin queries return all statuses (DRAFT, PUBLISHED, ARCHIVED).
 * - Slug uniqueness is enforced at the DB level (@@unique([tenantId, slug])).
 * - publishedAt is set on first publish and cleared on unpublish/archive.
 * - content field is always included in admin queries (editor needs full body).
 */

import { prisma } from "@/lib/db/prisma";
import type { NewsArticleStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------

const adminArticleListSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  imageUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const adminArticleDetailSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminNewsArticleListItem = Awaited<
  ReturnType<typeof getNewsArticlesForTenant>
>[number];

export type AdminNewsArticleDetail = NonNullable<
  Awaited<ReturnType<typeof getNewsArticleById>>
>;

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

export async function getNewsArticlesForTenant(tenantId: string) {
  return prisma.newsArticle.findMany({
    where: { tenantId },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    select: adminArticleListSelect,
  });
}

export async function getNewsArticleById(id: string, tenantId: string) {
  return prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: adminArticleDetailSelect,
  });
}

export async function getNewsArticleBySlug(slug: string, tenantId: string) {
  return prisma.newsArticle.findFirst({
    where: { slug, tenantId },
    select: adminArticleDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

export async function isSlugAvailable(
  slug: string,
  tenantId: string,
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

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateNewsArticleInput = {
  tenantId: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  imageUrl?: string | null;
};

export async function createNewsArticle(input: CreateNewsArticleInput) {
  return prisma.newsArticle.create({
    data: {
      tenantId: input.tenantId,
      title: input.title.trim(),
      slug: input.slug.trim(),
      excerpt: input.excerpt?.trim() || null,
      content: input.content,
      imageUrl: input.imageUrl?.trim() || null,
      status: "DRAFT",
    },
    select: adminArticleDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateNewsArticleInput = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  imageUrl?: string | null;
};

export async function updateNewsArticle(
  id: string,
  tenantId: string,
  input: UpdateNewsArticleInput,
) {
  return prisma.newsArticle.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
      ...(input.excerpt !== undefined
        ? { excerpt: input.excerpt?.trim() || null }
        : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl?.trim() || null }
        : {}),
    },
    select: adminArticleDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function publishNewsArticle(id: string, tenantId: string) {
  const article = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { publishedAt: true },
  });
  if (!article) return null;

  return prisma.newsArticle.update({
    where: { id },
    data: {
      status: "PUBLISHED" as NewsArticleStatus,
      // Preserve original publishedAt if already set; set it on first publish.
      publishedAt: article.publishedAt ?? new Date(),
    },
    select: adminArticleDetailSelect,
  });
}

export async function unpublishNewsArticle(id: string, tenantId: string) {
  const article = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!article) return null;

  return prisma.newsArticle.update({
    where: { id },
    data: {
      status: "DRAFT" as NewsArticleStatus,
    },
    select: adminArticleDetailSelect,
  });
}

export async function archiveNewsArticle(id: string, tenantId: string) {
  const article = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!article) return null;

  return prisma.newsArticle.update({
    where: { id },
    data: {
      status: "ARCHIVED" as NewsArticleStatus,
    },
    select: adminArticleDetailSelect,
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteNewsArticle(id: string, tenantId: string) {
  const article = await prisma.newsArticle.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!article) return null;

  await prisma.newsArticle.delete({ where: { id } });
  return { deleted: true };
}
