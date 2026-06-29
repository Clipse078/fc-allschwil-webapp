/**
 * Publishing Center — unified query layer.
 *
 * Aggregates NewsArticle and WebsitePage into one list with shared
 * PublishableItem shape. All queries are tenant-scoped.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  FilterContentType,
  FilterStatus,
  PublishableItem,
  PublishingStatus,
  PublishingStatusCounts,
} from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyStatusCounts(): PublishingStatusCounts {
  return { DRAFT: 0, IN_REVIEW: 0, SCHEDULED: 0, PUBLISHED: 0, ARCHIVED: 0, EXPIRED: 0, total: 0 };
}

function resolveNewsAuthor(
  authorName: string | null,
  authorPerson: { firstName: string; lastName: string; displayName: string | null } | null,
): string | null {
  if (authorPerson) {
    return authorPerson.displayName ?? `${authorPerson.firstName} ${authorPerson.lastName}`.trim();
  }
  return authorName ?? null;
}

function resolvePageAuthor(
  authorPerson: { firstName: string; lastName: string; displayName: string | null } | null,
): string | null {
  if (!authorPerson) return null;
  return authorPerson.displayName ?? `${authorPerson.firstName} ${authorPerson.lastName}`.trim();
}

// ── Status counts ─────────────────────────────────────────────────────────────

export async function getNewsStatusCounts(tenantId: string): Promise<PublishingStatusCounts> {
  const groups = await prisma.newsArticle.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const counts = emptyStatusCounts();
  for (const g of groups) {
    const s = g.status as PublishingStatus;
    counts[s] = g._count._all;
    counts.total += g._count._all;
  }
  return counts;
}

export async function getPageStatusCounts(tenantId: string): Promise<PublishingStatusCounts> {
  const groups = await prisma.websitePage.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { _all: true },
  });
  const counts = emptyStatusCounts();
  for (const g of groups) {
    const s = g.status as PublishingStatus;
    counts[s] = g._count._all;
    counts.total += g._count._all;
  }
  return counts;
}

function mergeCounts(
  a: PublishingStatusCounts,
  b: PublishingStatusCounts,
): PublishingStatusCounts {
  return {
    DRAFT: a.DRAFT + b.DRAFT,
    IN_REVIEW: a.IN_REVIEW + b.IN_REVIEW,
    SCHEDULED: a.SCHEDULED + b.SCHEDULED,
    PUBLISHED: a.PUBLISHED + b.PUBLISHED,
    ARCHIVED: a.ARCHIVED + b.ARCHIVED,
    EXPIRED: (a.EXPIRED ?? 0) + (b.EXPIRED ?? 0),
    total: a.total + b.total,
  };
}

// ── Item list ─────────────────────────────────────────────────────────────────

export type ListPublishableItemsInput = {
  tenantId: string;
  typeFilter: FilterContentType;
  statusFilter: FilterStatus;
  /** Whether the caller can see/manage news. */
  canManageNews: boolean;
  /** Whether the caller can see/manage pages. */
  canManagePages: boolean;
  limit: number;
  offset: number;
};

const newsAuthorPersonSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} as const;

const newsListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  authorName: true,
  authorPerson: { select: newsAuthorPersonSelect },
  updatedAt: true,
  publishedAt: true,
  scheduledAt: true,
} as const;

const pageListSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  authorPerson: { select: newsAuthorPersonSelect },
  updatedAt: true,
  publishedAt: true,
  scheduledAt: true,
} as const;

type AuthorPersonSnippet = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
} | null;

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  authorName: string | null;
  authorPerson: AuthorPersonSnippet;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledAt: Date | null;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  authorPerson: AuthorPersonSnippet;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledAt: Date | null;
};

export async function listPublishableItems(
  input: ListPublishableItemsInput,
): Promise<{ items: PublishableItem[]; total: number }> {
  const { tenantId, typeFilter, statusFilter, canManageNews, canManagePages, limit, offset } =
    input;

  // EXPIRED is a V4.2 UI status not yet in the DB enum; filter it as ARCHIVED
  const dbStatus =
    statusFilter === "ALL" ? null
    : statusFilter === "EXPIRED" ? "ARCHIVED"
    : statusFilter;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusWhere = dbStatus ? { status: dbStatus as any } : {};

  // Build individual lists based on access and type filter
  const fetchNews =
    canManageNews && (typeFilter === "ALL" || typeFilter === "news");
  const fetchPages =
    canManagePages && (typeFilter === "ALL" || typeFilter === "page");

  const [newsRowsRaw, pageRowsRaw] = await Promise.all([
    fetchNews
      ? prisma.newsArticle.findMany({
          where: { tenantId, ...statusWhere },
          orderBy: { updatedAt: "desc" },
          // Fetch all matching items pre-merge; trim after sort
          take: limit + offset,
          skip: 0,
          select: newsListSelect,
        })
      : Promise.resolve([] as NewsRow[]),
    fetchPages
      ? prisma.websitePage.findMany({
          where: { tenantId, ...statusWhere },
          orderBy: { updatedAt: "desc" },
          take: limit + offset,
          skip: 0,
          select: pageListSelect,
        })
      : Promise.resolve([] as PageRow[]),
  ]);

  const newsRows = newsRowsRaw as unknown as NewsRow[];
  const pageRows = pageRowsRaw as unknown as PageRow[];

  // Map to unified shape
  const newsItems: PublishableItem[] = newsRows.map((a) => ({
    id: a.id,
    type: "news" as const,
    title: a.title,
    slug: a.slug,
    status: a.status as PublishingStatus,
    authorDisplay: resolveNewsAuthor(a.authorName, a.authorPerson),
    updatedAt: a.updatedAt.toISOString(),
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString() : null,
    expiresAt: null,
    editHref: `/dashboard/website/news/${a.id}/edit`,
  }));

  const pageItems: PublishableItem[] = pageRows.map((p) => ({
    id: p.id,
    type: "page" as const,
    title: p.title,
    slug: p.slug,
    status: p.status as PublishingStatus,
    authorDisplay: resolvePageAuthor(p.authorPerson),
    updatedAt: p.updatedAt.toISOString(),
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    expiresAt: null,
    editHref: `/dashboard/website/pages/${p.id}/edit`,
  }));

  // Merge and sort by updatedAt descending
  const merged = [...newsItems, ...pageItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const total = merged.length;
  const items = merged.slice(offset, offset + limit);

  return { items, total };
}

// ── Full overview (counts + items) ────────────────────────────────────────────

export type GetPublishingOverviewInput = {
  tenantId: string;
  typeFilter: FilterContentType;
  statusFilter: FilterStatus;
  canManageNews: boolean;
  canManagePages: boolean;
  limit: number;
  offset: number;
};

export async function getPublishingOverview(input: GetPublishingOverviewInput): Promise<{
  items: PublishableItem[];
  counts: {
    all: PublishingStatusCounts;
    news: PublishingStatusCounts;
    pages: PublishingStatusCounts;
  };
  meta: { total: number; limit: number; offset: number };
}> {
  const [newsCountsResult, pagesCountsResult, listResult] = await Promise.all([
    input.canManageNews ? getNewsStatusCounts(input.tenantId) : Promise.resolve(emptyStatusCounts()),
    input.canManagePages ? getPageStatusCounts(input.tenantId) : Promise.resolve(emptyStatusCounts()),
    listPublishableItems(input),
  ]);

  return {
    items: listResult.items,
    counts: {
      all: mergeCounts(newsCountsResult, pagesCountsResult),
      news: newsCountsResult,
      pages: pagesCountsResult,
    },
    meta: {
      total: listResult.total,
      limit: input.limit,
      offset: input.offset,
    },
  };
}
