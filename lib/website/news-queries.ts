/**
 * lib/website/news-queries.ts
 *
 * Database queries for NewsPost — the tenant-scoped news articles published
 * to the public website.
 */

import { prisma } from "@/lib/db/prisma";
export { generateNewsSlug } from "@/lib/website/slug-utils";

// ── Public select (safe for unauthenticated surfaces) ─────────────────────────

const publicNewsSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  authorName: true,
  publishedAt: true,
} as const;

const publicNewsDetailSelect = {
  ...publicNewsSelect,
  body: true,
} as const;

// ── Admin select (includes draft/unpublished state) ───────────────────────────

const adminNewsSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  coverImageUrl: true,
  authorName: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublicNewsSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  publishedAt: Date | null;
};

export type PublicNewsDetail = PublicNewsSummary & { body: string };

export type AdminNewsItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  authorName: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Public reads ──────────────────────────────────────────────────────────────

export async function getPublishedNewsPosts(
  tenantId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PublicNewsSummary[]> {
  return prisma.newsPost.findMany({
    where: { tenantId, isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: opts.limit ?? 20,
    skip: opts.offset ?? 0,
    select: publicNewsSelect,
  });
}

export async function countPublishedNewsPosts(tenantId: string): Promise<number> {
  return prisma.newsPost.count({ where: { tenantId, isPublished: true } });
}

export async function getPublishedNewsPostBySlug(
  tenantId: string,
  slug: string,
): Promise<PublicNewsDetail | null> {
  return prisma.newsPost.findFirst({
    where: { tenantId, slug, isPublished: true },
    select: publicNewsDetailSelect,
  }) as Promise<PublicNewsDetail | null>;
}

// ── Admin reads ───────────────────────────────────────────────────────────────

export async function getNewsPostsForAdmin(tenantId: string): Promise<AdminNewsItem[]> {
  return prisma.newsPost.findMany({
    where: { tenantId },
    orderBy: [{ isPublished: "asc" }, { updatedAt: "desc" }],
    select: adminNewsSelect,
  });
}

export async function getNewsPostByIdForAdmin(
  tenantId: string,
  id: string,
): Promise<AdminNewsItem | null> {
  return prisma.newsPost.findFirst({
    where: { id, tenantId },
    select: adminNewsSelect,
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

export type CreateNewsPostInput = {
  tenantId: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body?: string;
  coverImageUrl?: string | null;
  authorName?: string | null;
  isPublished?: boolean;
};

export async function createNewsPost(input: CreateNewsPostInput): Promise<AdminNewsItem> {
  const isPublished = input.isPublished ?? false;
  return prisma.newsPost.create({
    data: {
      tenantId: input.tenantId,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt ?? null,
      body: input.body ?? "",
      coverImageUrl: input.coverImageUrl ?? null,
      authorName: input.authorName ?? null,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    },
    select: adminNewsSelect,
  });
}

export type UpdateNewsPostInput = {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  body?: string;
  coverImageUrl?: string | null;
  authorName?: string | null;
  isPublished?: boolean;
};

export async function updateNewsPost(
  tenantId: string,
  id: string,
  input: UpdateNewsPostInput,
): Promise<AdminNewsItem | null> {
  const existing = await getNewsPostByIdForAdmin(tenantId, id);
  if (!existing) return null;

  const isPublished = input.isPublished ?? existing.isPublished;
  const publishedAt =
    isPublished && !existing.publishedAt ? new Date() : existing.publishedAt;

  return prisma.newsPost.update({
    where: { id },
    data: {
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.excerpt !== undefined && { excerpt: input.excerpt }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
      ...(input.authorName !== undefined && { authorName: input.authorName }),
      isPublished,
      publishedAt,
    },
    select: adminNewsSelect,
  });
}

export async function deleteNewsPost(tenantId: string, id: string): Promise<boolean> {
  const existing = await getNewsPostByIdForAdmin(tenantId, id);
  if (!existing) return false;
  await prisma.newsPost.delete({ where: { id } });
  return true;
}

