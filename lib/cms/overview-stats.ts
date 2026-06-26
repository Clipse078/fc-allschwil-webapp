/**
 * lib/cms/overview-stats.ts
 *
 * Server-side data loader for the CMS hub overview dashboard.
 *
 * Returns real application state so the overview reflects live content.
 * Tenant-safe: all queries are scoped to tenantId.
 */

import { prisma } from "@/lib/db/prisma";

export type CmsOverviewStats = {
  news: {
    total: number;
    published: number;
    draft: number;
    inReview: number;
    scheduled: number;
  };
  pages: {
    total: number;
    published: number;
    draft: number;
    inReview: number;
    scheduled: number;
  };
  media: {
    total: number;
  };
  publishing: {
    pendingReview: number;
    scheduledTotal: number;
  };
  approvedDataOnly: boolean;
  websiteEnabled: boolean;
};

export async function getCmsOverviewStats(tenantId: string): Promise<CmsOverviewStats> {
  const [
    newsStats,
    pageStats,
    mediaCount,
    tenantFlags,
  ] = await Promise.all([
    // News counts by status
    prisma.newsArticle.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
    }),

    // Page counts by status
    prisma.websitePage.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
    }),

    // Media asset count
    prisma.mediaAsset.count({ where: { tenantId } }),

    // Tenant website flags
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { approvedDataOnly: true, websiteEnabled: true },
    }),
  ]);

  function countByStatus(
    groups: { status: string; _count: { id: number } }[],
    status: string,
  ): number {
    return groups.find((g) => g.status === status)?._count.id ?? 0;
  }

  type GroupByRow = { _count: { id: number } };
  const newsTotal = newsStats.reduce((sum: number, g: GroupByRow) => sum + g._count.id, 0);
  const pagesTotal = pageStats.reduce((sum: number, g: GroupByRow) => sum + g._count.id, 0);

  const newsInReview = countByStatus(newsStats, "IN_REVIEW");
  const pagesInReview = countByStatus(pageStats, "IN_REVIEW");
  const newsScheduled = countByStatus(newsStats, "SCHEDULED");
  const pagesScheduled = countByStatus(pageStats, "SCHEDULED");

  return {
    news: {
      total: newsTotal,
      published: countByStatus(newsStats, "PUBLISHED"),
      draft: countByStatus(newsStats, "DRAFT"),
      inReview: newsInReview,
      scheduled: newsScheduled,
    },
    pages: {
      total: pagesTotal,
      published: countByStatus(pageStats, "PUBLISHED"),
      draft: countByStatus(pageStats, "DRAFT"),
      inReview: pagesInReview,
      scheduled: pagesScheduled,
    },
    media: {
      total: mediaCount,
    },
    publishing: {
      pendingReview: newsInReview + pagesInReview,
      scheduledTotal: newsScheduled + pagesScheduled,
    },
    approvedDataOnly: tenantFlags?.approvedDataOnly ?? false,
    websiteEnabled: tenantFlags?.websiteEnabled ?? true,
  };
}
