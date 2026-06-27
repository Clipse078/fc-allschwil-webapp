/**
 * lib/cms/editorial/queries.ts
 *
 * Editorial Center data query layer (CMS V2 Slice 10).
 *
 * Provides normalized data aggregation over existing CMS entities.
 * All queries are tenant-scoped. No new business logic is introduced.
 *
 * Reuses:
 *   - WebsitePage / NewsArticle publishing workflow
 *   - HomepageSection / WebsitePageSection section publishing engine
 *   - ContentRevision for activity signals
 *   - AuditLog for editorial activity feed
 *
 * Design:
 *   - Each adapter function normalizes one entity type into the shared shape.
 *   - Aggregate functions combine adapters and sort/limit the results.
 *   - All returned values are JSON-safe (Dates serialized to ISO strings).
 */

import { prisma } from "@/lib/db/prisma";
import {
  SECTION_PUBLISH_STATUS,
  SECTION_APPROVAL_STATUS,
  SECTION_APPROVAL_STATUS_LABELS,
  SECTION_PUBLISH_STATUS_LABELS,
} from "@/lib/cms/section-publishing";
import {
  EDITORIAL_ENTITY_LABEL,
  getActionLabel,
  type EditorialEntityType,
  type EditorialKpis,
  type EditorialQueueItem,
  type EditorialScheduledItem,
  type EditorialDraftItem,
  type EditorialRecentItem,
  type EditorialActivityItem,
  type ContentHealthIssue,
  type ContentHealthIssueItem,
  type EditorialOverviewData,
  type EditorialHealthData,
} from "./types";

// ── Status label helpers (reuse existing label maps) ─────────────────────────

const PAGE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

// ── Edit URL helpers ──────────────────────────────────────────────────────────

function homepageSectionEditUrl(): string {
  return "/dashboard/website/homepage";
}

function websitePageEditUrl(pageId: string): string {
  return `/dashboard/website/pages/${pageId}/builder`;
}

function newsEditUrl(newsId: string): string {
  return `/dashboard/website/news/${newsId}/edit`;
}

function pageSectionEditUrl(pageId: string): string {
  return `/dashboard/website/pages/${pageId}/builder`;
}

// ── KPI queries ───────────────────────────────────────────────────────────────

export async function getEditorialKpis(tenantId: string): Promise<EditorialKpis> {
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    pageStatusGroups,
    newsStatusGroups,
    homepageSectionPublishGroups,
    homepageSectionApprovalGroups,
    pageSectionPublishGroups,
    pageSectionApprovalGroups,
    expiringSoonCount,
    recentRevisionCount,
    homepageScheduledCount,
    pageSectionScheduledCount,
  ] = await Promise.all([
    // Page statuses
    prisma.websitePage.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // News statuses
    prisma.newsArticle.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // Homepage section publish status
    prisma.homepageSection.groupBy({
      by: ["publishStatus"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // Homepage section approval status
    prisma.homepageSection.groupBy({
      by: ["approvalStatus"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // Page section publish status
    prisma.websitePageSection.groupBy({
      by: ["publishStatus"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // Page section approval status
    prisma.websitePageSection.groupBy({
      by: ["approvalStatus"],
      where: { tenantId },
      _count: { _all: true },
    }),
    // Sections expiring soon
    prisma.websitePageSection.count({
      where: {
        tenantId,
        isEnabled: true,
        publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
        publishUntil: { gte: now, lte: in7days },
      },
    }),
    // Recent revisions (last 24h)
    prisma.contentRevision.count({
      where: { tenantId, createdAt: { gte: yesterday } },
    }),
    // Homepage sections with scheduled publish
    prisma.homepageSection.count({
      where: { tenantId, scheduledPublishAt: { not: null } },
    }),
    // Page sections with scheduled publish
    prisma.websitePageSection.count({
      where: { tenantId, scheduledPublishAt: { not: null } },
    }),
  ]);

  // Build status count maps
  const pageMap = Object.fromEntries(
    pageStatusGroups.map((g) => [g.status, g._count._all]),
  );
  const newsMap = Object.fromEntries(
    newsStatusGroups.map((g) => [g.status, g._count._all]),
  );
  const hpPublishMap = Object.fromEntries(
    homepageSectionPublishGroups.map((g) => [g.publishStatus, g._count._all]),
  );
  const hpApprovalMap = Object.fromEntries(
    homepageSectionApprovalGroups.map((g) => [g.approvalStatus, g._count._all]),
  );
  const psPublishMap = Object.fromEntries(
    pageSectionPublishGroups.map((g) => [g.publishStatus, g._count._all]),
  );
  const psApprovalMap = Object.fromEntries(
    pageSectionApprovalGroups.map((g) => [g.approvalStatus, g._count._all]),
  );

  const drafts =
    (pageMap["DRAFT"] ?? 0) +
    (newsMap["DRAFT"] ?? 0) +
    (hpPublishMap["DRAFT"] ?? 0) +
    (psPublishMap["DRAFT"] ?? 0);

  const inReview =
    (pageMap["IN_REVIEW"] ?? 0) +
    (newsMap["IN_REVIEW"] ?? 0) +
    (hpApprovalMap["IN_REVIEW"] ?? 0) +
    (psApprovalMap["IN_REVIEW"] ?? 0);

  const scheduledPages =
    (pageMap["SCHEDULED"] ?? 0) + (newsMap["SCHEDULED"] ?? 0);
  const scheduled =
    scheduledPages + homepageScheduledCount + pageSectionScheduledCount;

  const published =
    (pageMap["PUBLISHED"] ?? 0) +
    (newsMap["PUBLISHED"] ?? 0) +
    (hpPublishMap["PUBLISHED"] ?? 0) +
    (psPublishMap["PUBLISHED"] ?? 0);

  const archived = (pageMap["ARCHIVED"] ?? 0) + (newsMap["ARCHIVED"] ?? 0);

  return {
    drafts,
    inReview,
    scheduled,
    published,
    archived,
    expiringSoon: expiringSoonCount,
    recentRevisions: recentRevisionCount,
  };
}

// ── Review queue ──────────────────────────────────────────────────────────────

/** Unified review queue: sections in approval workflow + pages awaiting review */
export async function getEditorialReviewQueue(
  tenantId: string,
  limit = 50,
): Promise<EditorialQueueItem[]> {
  const reviewApprovalStatuses = [
    SECTION_APPROVAL_STATUS.IN_REVIEW,
    SECTION_APPROVAL_STATUS.CHANGES_REQUESTED,
    SECTION_APPROVAL_STATUS.DRAFT,
  ];

  const [homepageSections, pageSections, pagesInReview] = await Promise.all([
    // Homepage sections in approval workflow
    prisma.homepageSection.findMany({
      where: { tenantId, approvalStatus: { in: reviewApprovalStatuses } },
      orderBy: [{ reviewRequestedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        label: true,
        approvalStatus: true,
        publishStatus: true,
        updatedAt: true,
        reviewRequestedAt: true,
      },
    }),
    // Page sections in approval workflow
    prisma.websitePageSection.findMany({
      where: { tenantId, approvalStatus: { in: reviewApprovalStatuses } },
      orderBy: [{ reviewRequestedAt: "desc" }, { updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        label: true,
        pageId: true,
        approvalStatus: true,
        publishStatus: true,
        updatedAt: true,
        reviewRequestedAt: true,
        page: { select: { id: true, title: true } },
      },
    }),
    // Website pages in review
    prisma.websitePage.findMany({
      where: { tenantId, status: { in: ["IN_REVIEW", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  const items: EditorialQueueItem[] = [];

  for (const s of homepageSections) {
    items.push({
      id: s.id,
      entityType: "HomepageSection",
      title: s.label || "(Ohne Bezeichnung)",
      workflowStatus: s.approvalStatus,
      workflowStatusLabel:
        SECTION_APPROVAL_STATUS_LABELS[
          s.approvalStatus as keyof typeof SECTION_APPROVAL_STATUS_LABELS
        ] ?? s.approvalStatus,
      publishStatus: s.publishStatus,
      publishStatusLabel:
        SECTION_PUBLISH_STATUS_LABELS[
          s.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
        ] ?? s.publishStatus,
      updatedAt: s.updatedAt.toISOString(),
      reviewRequestedAt: s.reviewRequestedAt
        ? s.reviewRequestedAt.toISOString()
        : null,
      sourceLocation: "Homepage",
      editUrl: homepageSectionEditUrl(),
    });
  }

  for (const s of pageSections) {
    items.push({
      id: s.id,
      entityType: "WebsitePageSection",
      title: s.label || "(Ohne Bezeichnung)",
      workflowStatus: s.approvalStatus,
      workflowStatusLabel:
        SECTION_APPROVAL_STATUS_LABELS[
          s.approvalStatus as keyof typeof SECTION_APPROVAL_STATUS_LABELS
        ] ?? s.approvalStatus,
      publishStatus: s.publishStatus,
      publishStatusLabel:
        SECTION_PUBLISH_STATUS_LABELS[
          s.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
        ] ?? s.publishStatus,
      updatedAt: s.updatedAt.toISOString(),
      reviewRequestedAt: s.reviewRequestedAt
        ? s.reviewRequestedAt.toISOString()
        : null,
      sourceLocation: s.page?.title ?? null,
      editUrl: pageSectionEditUrl(s.pageId),
    });
  }

  for (const p of pagesInReview) {
    items.push({
      id: p.id,
      entityType: "WebsitePage",
      title: p.title,
      workflowStatus: p.status,
      workflowStatusLabel: PAGE_STATUS_LABEL[p.status] ?? p.status,
      publishStatus: p.status,
      publishStatusLabel: PAGE_STATUS_LABEL[p.status] ?? p.status,
      updatedAt: p.updatedAt.toISOString(),
      reviewRequestedAt: null,
      sourceLocation: null,
      editUrl: websitePageEditUrl(p.id),
    });
  }

  // Sort by most recently requested or updated
  return items
    .sort((a, b) => {
      const aTime = a.reviewRequestedAt ?? a.updatedAt;
      const bTime = b.reviewRequestedAt ?? b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, limit);
}

// ── Scheduled publications ────────────────────────────────────────────────────

export async function getScheduledPublications(
  tenantId: string,
  limit = 30,
): Promise<EditorialScheduledItem[]> {
  const now = new Date();

  const [homepageSections, pageSections, pages, news] = await Promise.all([
    // Homepage sections with a scheduled publish date
    prisma.homepageSection.findMany({
      where: { tenantId, scheduledPublishAt: { not: null } },
      orderBy: { scheduledPublishAt: "asc" },
      take: limit,
      select: {
        id: true,
        label: true,
        publishStatus: true,
        scheduledPublishAt: true,
      },
    }),
    // Page sections with a scheduled publish date
    prisma.websitePageSection.findMany({
      where: { tenantId, scheduledPublishAt: { not: null } },
      orderBy: { scheduledPublishAt: "asc" },
      take: limit,
      select: {
        id: true,
        label: true,
        pageId: true,
        publishStatus: true,
        scheduledPublishAt: true,
        publishUntil: true,
        page: { select: { id: true, title: true } },
      },
    }),
    // Pages with SCHEDULED status or future scheduledAt
    prisma.websitePage.findMany({
      where: {
        tenantId,
        OR: [
          { status: "SCHEDULED" },
          { scheduledAt: { gt: now } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
      },
    }),
    // News with SCHEDULED status or future scheduledAt
    prisma.newsArticle.findMany({
      where: {
        tenantId,
        OR: [
          { status: "SCHEDULED" },
          { scheduledAt: { gt: now } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
      },
    }),
  ]);

  const items: EditorialScheduledItem[] = [];

  for (const s of homepageSections) {
    items.push({
      id: s.id,
      entityType: "HomepageSection",
      title: s.label || "(Ohne Bezeichnung)",
      scheduledAt: s.scheduledPublishAt
        ? s.scheduledPublishAt.toISOString()
        : null,
      expiresAt: null,
      publishStatus: s.publishStatus,
      publishStatusLabel:
        SECTION_PUBLISH_STATUS_LABELS[
          s.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
        ] ?? s.publishStatus,
      sourceLocation: "Homepage",
      editUrl: homepageSectionEditUrl(),
    });
  }

  for (const s of pageSections) {
    items.push({
      id: s.id,
      entityType: "WebsitePageSection",
      title: s.label || "(Ohne Bezeichnung)",
      scheduledAt: s.scheduledPublishAt
        ? s.scheduledPublishAt.toISOString()
        : null,
      expiresAt: s.publishUntil ? s.publishUntil.toISOString() : null,
      publishStatus: s.publishStatus,
      publishStatusLabel:
        SECTION_PUBLISH_STATUS_LABELS[
          s.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
        ] ?? s.publishStatus,
      sourceLocation: s.page?.title ?? null,
      editUrl: pageSectionEditUrl(s.pageId),
    });
  }

  for (const p of pages) {
    items.push({
      id: p.id,
      entityType: "WebsitePage",
      title: p.title,
      scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
      expiresAt: null,
      publishStatus: p.status,
      publishStatusLabel: PAGE_STATUS_LABEL[p.status] ?? p.status,
      sourceLocation: null,
      editUrl: websitePageEditUrl(p.id),
    });
  }

  for (const n of news) {
    items.push({
      id: n.id,
      entityType: "NewsArticle",
      title: n.title,
      scheduledAt: n.scheduledAt ? n.scheduledAt.toISOString() : null,
      expiresAt: null,
      publishStatus: n.status,
      publishStatusLabel: PAGE_STATUS_LABEL[n.status] ?? n.status,
      sourceLocation: null,
      editUrl: newsEditUrl(n.id),
    });
  }

  // Sort by scheduled date ascending (soonest first), then by type
  return items
    .sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return aTime - bTime;
    })
    .slice(0, limit);
}

// ── Draft overview ────────────────────────────────────────────────────────────

export async function getDraftOverview(
  tenantId: string,
  limit = 40,
): Promise<EditorialDraftItem[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [homepageDrafts, pageSectionDrafts, pageDrafts, newsDrafts] =
    await Promise.all([
      prisma.homepageSection.findMany({
        where: {
          tenantId,
          publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          label: true,
          publishStatus: true,
          updatedAt: true,
        },
      }),
      prisma.websitePageSection.findMany({
        where: {
          tenantId,
          publishStatus: SECTION_PUBLISH_STATUS.DRAFT,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          label: true,
          pageId: true,
          publishStatus: true,
          updatedAt: true,
          page: { select: { id: true, title: true } },
        },
      }),
      prisma.websitePage.findMany({
        where: { tenantId, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      prisma.newsArticle.findMany({
        where: { tenantId, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ]);

  const items: EditorialDraftItem[] = [];

  for (const s of homepageDrafts) {
    const ageInDays = Math.floor(
      (now.getTime() - s.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    items.push({
      id: s.id,
      entityType: "HomepageSection",
      title: s.label || "(Ohne Bezeichnung)",
      updatedAt: s.updatedAt.toISOString(),
      ageInDays,
      isOld: s.updatedAt < thirtyDaysAgo,
      sourceLocation: "Homepage",
      editUrl: homepageSectionEditUrl(),
    });
  }

  for (const s of pageSectionDrafts) {
    const ageInDays = Math.floor(
      (now.getTime() - s.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    items.push({
      id: s.id,
      entityType: "WebsitePageSection",
      title: s.label || "(Ohne Bezeichnung)",
      updatedAt: s.updatedAt.toISOString(),
      ageInDays,
      isOld: s.updatedAt < thirtyDaysAgo,
      sourceLocation: s.page?.title ?? null,
      editUrl: pageSectionEditUrl(s.pageId),
    });
  }

  for (const p of pageDrafts) {
    const ageInDays = Math.floor(
      (now.getTime() - p.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    items.push({
      id: p.id,
      entityType: "WebsitePage",
      title: p.title,
      updatedAt: p.updatedAt.toISOString(),
      ageInDays,
      isOld: p.updatedAt < thirtyDaysAgo,
      sourceLocation: null,
      editUrl: websitePageEditUrl(p.id),
    });
  }

  for (const n of newsDrafts) {
    const ageInDays = Math.floor(
      (now.getTime() - n.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    items.push({
      id: n.id,
      entityType: "NewsArticle",
      title: n.title,
      updatedAt: n.updatedAt.toISOString(),
      ageInDays,
      isOld: n.updatedAt < thirtyDaysAgo,
      sourceLocation: null,
      editUrl: newsEditUrl(n.id),
    });
  }

  // Sort: old drafts first, then by most recently updated
  return items
    .sort((a, b) => {
      if (a.isOld !== b.isOld) return a.isOld ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, limit);
}

// ── Recently changed ──────────────────────────────────────────────────────────

export async function getRecentlyChanged(
  tenantId: string,
  limit = 20,
): Promise<EditorialRecentItem[]> {
  // Use ContentRevision as primary source (captures all CMS edits)
  const revisions = await prisma.contentRevision.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit * 3, // Fetch extra to de-duplicate by entityId
    select: {
      id: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      createdByUserId: true,
      isRestore: true,
      createdByUser: { select: { firstName: true, lastName: true } },
    },
  });

  // De-duplicate: keep only the most recent revision per entity
  const seen = new Set<string>();
  const deduped = revisions.filter((r) => {
    const key = `${r.entityType}:${r.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fetch entity details for each unique entity
  const items: EditorialRecentItem[] = [];

  for (const rev of deduped.slice(0, limit)) {
    const entityKey = `${rev.entityType}:${rev.entityId}`;
    const actorName = rev.createdByUser
      ? `${rev.createdByUser.firstName} ${rev.createdByUser.lastName}`.trim()
      : null;

    if (rev.entityType === "HomepageSection") {
      const section = await prisma.homepageSection.findFirst({
        where: { id: rev.entityId, tenantId },
        select: { id: true, label: true, publishStatus: true },
      });
      if (section) {
        items.push({
          id: entityKey,
          entityType: "HomepageSection",
          title: section.label || "(Ohne Bezeichnung)",
          publishStatus: section.publishStatus,
          publishStatusLabel:
            SECTION_PUBLISH_STATUS_LABELS[
              section.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
            ] ?? section.publishStatus,
          changedAt: rev.createdAt.toISOString(),
          actorName,
          editUrl: homepageSectionEditUrl(),
        });
      }
    } else if (rev.entityType === "WebsitePageSection") {
      const section = await prisma.websitePageSection.findFirst({
        where: { id: rev.entityId, tenantId },
        select: {
          id: true,
          label: true,
          pageId: true,
          publishStatus: true,
        },
      });
      if (section) {
        items.push({
          id: entityKey,
          entityType: "WebsitePageSection",
          title: section.label || "(Ohne Bezeichnung)",
          publishStatus: section.publishStatus,
          publishStatusLabel:
            SECTION_PUBLISH_STATUS_LABELS[
              section.publishStatus as keyof typeof SECTION_PUBLISH_STATUS_LABELS
            ] ?? section.publishStatus,
          changedAt: rev.createdAt.toISOString(),
          actorName,
          editUrl: pageSectionEditUrl(section.pageId),
        });
      }
    } else if (rev.entityType === "WebsitePage") {
      const page = await prisma.websitePage.findFirst({
        where: { id: rev.entityId, tenantId },
        select: { id: true, title: true, status: true },
      });
      if (page) {
        items.push({
          id: entityKey,
          entityType: "WebsitePage",
          title: page.title,
          publishStatus: page.status,
          publishStatusLabel: PAGE_STATUS_LABEL[page.status] ?? page.status,
          changedAt: rev.createdAt.toISOString(),
          actorName,
          editUrl: websitePageEditUrl(page.id),
        });
      }
    }
  }

  return items.slice(0, limit);
}

// ── Activity feed ─────────────────────────────────────────────────────────────

/** Entity-type to edit URL builder */
function resolveEditUrl(entityType: string, entityId: string): string | null {
  if (entityType === "HomepageSection") return homepageSectionEditUrl();
  if (entityType === "WebsitePageSection") return null; // Would need pageId from metadataJson
  if (entityType === "WebsitePage") return websitePageEditUrl(entityId);
  if (entityType === "NewsArticle") return newsEditUrl(entityId);
  return null;
}

export async function getEditorialActivity(
  tenantId: string,
  limit = 25,
): Promise<EditorialActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      moduleKey: { in: ["homepage", "page-sections"] },
      actorUser: { tenantId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      metadataJson: true,
      createdAt: true,
      actorUser: { select: { firstName: true, lastName: true } },
    },
  });

  return logs.map((log) => {
    const actorName = log.actorUser
      ? `${log.actorUser.firstName} ${log.actorUser.lastName}`.trim()
      : null;

    // Try to resolve editUrl — page sections need pageId from metadata
    let editUrl = resolveEditUrl(log.entityType, log.entityId);
    if (!editUrl && log.entityType === "WebsitePageSection") {
      const meta = log.metadataJson as Record<string, unknown> | null;
      const pageId = meta?.pageId as string | undefined;
      if (pageId) editUrl = pageSectionEditUrl(pageId);
    }

    return {
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      actionLabel: getActionLabel(log.action),
      actorName,
      createdAt: log.createdAt.toISOString(),
      editUrl,
    };
  });
}

// ── Content health checks ─────────────────────────────────────────────────────

export async function getContentHealthIssues(
  tenantId: string,
): Promise<EditorialHealthData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    oldDraftPages,
    oldDraftNews,
    disabledPublishedHomepageSections,
    disabledPublishedPageSections,
    expiredEnabledSections,
    pagesWithNoSections,
    sectionsWithEmptyLabels,
    recentlyRestoredRevisions,
  ] = await Promise.all([
    // Drafts older than 30 days (WebsitePage)
    prisma.websitePage.findMany({
      where: { tenantId, status: "DRAFT", updatedAt: { lt: thirtyDaysAgo } },
      select: { id: true, title: true, updatedAt: true },
      take: 20,
    }),
    // Drafts older than 30 days (NewsArticle)
    prisma.newsArticle.findMany({
      where: { tenantId, status: "DRAFT", updatedAt: { lt: thirtyDaysAgo } },
      select: { id: true, title: true, updatedAt: true },
      take: 20,
    }),
    // Sections disabled but still published (HomepageSection)
    prisma.homepageSection.findMany({
      where: {
        tenantId,
        isEnabled: false,
        publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      },
      select: { id: true, label: true },
      take: 20,
    }),
    // Sections disabled but still published (WebsitePageSection)
    prisma.websitePageSection.findMany({
      where: {
        tenantId,
        isEnabled: false,
        publishStatus: SECTION_PUBLISH_STATUS.PUBLISHED,
      },
      select: {
        id: true,
        label: true,
        pageId: true,
        page: { select: { title: true } },
      },
      take: 20,
    }),
    // Expired sections still enabled (WebsitePageSection only has publishUntil)
    prisma.websitePageSection.findMany({
      where: {
        tenantId,
        isEnabled: true,
        publishUntil: { lt: now, not: null },
      },
      select: {
        id: true,
        label: true,
        pageId: true,
        publishUntil: true,
        page: { select: { title: true } },
      },
      take: 20,
    }),
    // Pages without any sections
    prisma.websitePage.findMany({
      where: { tenantId, sections: { none: {} } },
      select: { id: true, title: true, status: true },
      take: 20,
    }),
    // Sections with empty labels (HomepageSection)
    prisma.homepageSection.findMany({
      where: { tenantId, label: "" },
      select: { id: true, label: true },
      take: 10,
    }),
    // Recently restored content (last 7 days)
    prisma.contentRevision.findMany({
      where: {
        tenantId,
        isRestore: true,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const issues: ContentHealthIssue[] = [];

  // 1. Old drafts
  const oldDraftItems: ContentHealthIssueItem[] = [
    ...oldDraftPages.map((p) => ({
      id: p.id,
      entityType: "WebsitePage" as EditorialEntityType,
      title: p.title,
      detail: `Entwurf seit ${Math.floor((now.getTime() - p.updatedAt.getTime()) / (24 * 60 * 60 * 1000))} Tagen unverändert`,
      editUrl: websitePageEditUrl(p.id),
    })),
    ...oldDraftNews.map((n) => ({
      id: n.id,
      entityType: "NewsArticle" as EditorialEntityType,
      title: n.title,
      detail: `Entwurf seit ${Math.floor((now.getTime() - n.updatedAt.getTime()) / (24 * 60 * 60 * 1000))} Tagen unverändert`,
      editUrl: newsEditUrl(n.id),
    })),
  ];

  if (oldDraftItems.length > 0) {
    issues.push({
      type: "old_draft",
      label: "Alte Entwürfe (> 30 Tage)",
      description:
        "Inhalte die seit mehr als 30 Tagen unbearbeitet im Entwurfsstatus sind.",
      count: oldDraftItems.length,
      items: oldDraftItems,
    });
  }

  // 2. Disabled but published sections
  const disabledPublishedItems: ContentHealthIssueItem[] = [
    ...disabledPublishedHomepageSections.map((s) => ({
      id: s.id,
      entityType: "HomepageSection" as EditorialEntityType,
      title: s.label || "(Ohne Bezeichnung)",
      detail: "Deaktiviert, aber Publishstatus: Veröffentlicht",
      editUrl: homepageSectionEditUrl(),
    })),
    ...disabledPublishedPageSections.map((s) => ({
      id: s.id,
      entityType: "WebsitePageSection" as EditorialEntityType,
      title: s.label || "(Ohne Bezeichnung)",
      detail: `Deaktiviert, aber Publishstatus: Veröffentlicht (Seite: ${s.page?.title ?? "–"})`,
      editUrl: pageSectionEditUrl(s.pageId),
    })),
  ];

  if (disabledPublishedItems.length > 0) {
    issues.push({
      type: "disabled_published",
      label: "Deaktiviert, aber veröffentlicht",
      description:
        "Sektionen die deaktiviert sind, aber noch den Publishstatus «Veröffentlicht» tragen.",
      count: disabledPublishedItems.length,
      items: disabledPublishedItems,
    });
  }

  // 3. Expired sections still enabled
  if (expiredEnabledSections.length > 0) {
    issues.push({
      type: "expired_enabled",
      label: "Abgelaufene Inhalte noch aktiv",
      description:
        "Seitenabschnitte deren Ablaufdatum überschritten ist, aber noch aktiviert sind.",
      count: expiredEnabledSections.length,
      items: expiredEnabledSections.map((s) => ({
        id: s.id,
        entityType: "WebsitePageSection" as EditorialEntityType,
        title: s.label || "(Ohne Bezeichnung)",
        detail: `Abgelaufen am ${s.publishUntil ? new Date(s.publishUntil).toLocaleDateString("de-CH") : "–"} (Seite: ${s.page?.title ?? "–"})`,
        editUrl: pageSectionEditUrl(s.pageId),
      })),
    });
  }

  // 4. Pages without sections
  if (pagesWithNoSections.length > 0) {
    issues.push({
      type: "page_no_sections",
      label: "Seiten ohne Abschnitte",
      description: "Website-Seiten die noch keine Sektionen haben.",
      count: pagesWithNoSections.length,
      items: pagesWithNoSections.map((p) => ({
        id: p.id,
        entityType: "WebsitePage" as EditorialEntityType,
        title: p.title,
        detail: `Status: ${PAGE_STATUS_LABEL[p.status] ?? p.status}`,
        editUrl: websitePageEditUrl(p.id),
      })),
    });
  }

  // 5. Sections with missing labels
  if (sectionsWithEmptyLabels.length > 0) {
    issues.push({
      type: "section_missing_label",
      label: "Sektionen ohne Bezeichnung",
      description: "Homepage-Sektionen ohne Bezeichnung.",
      count: sectionsWithEmptyLabels.length,
      items: sectionsWithEmptyLabels.map((s) => ({
        id: s.id,
        entityType: "HomepageSection" as EditorialEntityType,
        title: "(Ohne Bezeichnung)",
        detail: "Keine Bezeichnung vergeben",
        editUrl: homepageSectionEditUrl(),
      })),
    });
  }

  // 6. Recently restored content
  if (recentlyRestoredRevisions.length > 0) {
    issues.push({
      type: "recently_restored",
      label: "Kürzlich wiederhergestellt",
      description:
        "Inhalte die in den letzten 7 Tagen aus einer früheren Version wiederhergestellt wurden.",
      count: recentlyRestoredRevisions.length,
      items: recentlyRestoredRevisions.map((r) => {
        const editUrl = resolveEditUrl(r.entityType, r.entityId);
        return {
          id: r.id,
          entityType: (r.entityType as EditorialEntityType) || "WebsitePage",
          title: `${EDITORIAL_ENTITY_LABEL[r.entityType as EditorialEntityType] ?? r.entityType} (${r.entityId.slice(0, 8)}…)`,
          detail: `Wiederhergestellt am ${r.createdAt.toLocaleDateString("de-CH")}`,
          editUrl: editUrl ?? "#",
        };
      }),
    });
  }

  return {
    issues,
    totalWarnings: issues.reduce((sum, issue) => sum + issue.count, 0),
  };
}

// ── Full editorial overview (single API call) ─────────────────────────────────

export async function getEditorialOverview(
  tenantId: string,
): Promise<EditorialOverviewData> {
  const [kpis, reviewQueue, scheduledPublications, drafts, recentlyChanged, activity] =
    await Promise.all([
      getEditorialKpis(tenantId),
      getEditorialReviewQueue(tenantId, 20),
      getScheduledPublications(tenantId, 20),
      getDraftOverview(tenantId, 20),
      getRecentlyChanged(tenantId, 15),
      getEditorialActivity(tenantId, 20),
    ]);

  return {
    kpis,
    reviewQueue,
    scheduledPublications,
    drafts,
    recentlyChanged,
    activity,
  };
}
