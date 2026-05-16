import { WebsitePageStatus, WebsitePageType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type WebsiteSiteRow = {
  id: string;
  tenantKey: string;
  name: string;
  locale: string;
  sport: string;
  isActive: boolean;
};

export type WebsitePageRow = {
  id: string;
  slug: string;
  title: string;
  pageType: WebsitePageType;
  templateKey: string | null;
  locale: string;
  status: WebsitePageStatus;
  sortOrder: number;
  isVisible: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function getOrCreateDefaultSite(
  tenantKey: string,
  name: string,
): Promise<WebsiteSiteRow> {
  const existing = await prisma.websiteSite.findUnique({
    where: { tenantKey },
    select: { id: true, tenantKey: true, name: true, locale: true, sport: true, isActive: true },
  });

  if (existing) return existing;

  return prisma.websiteSite.create({
    data: { tenantKey, name },
    select: { id: true, tenantKey: true, name: true, locale: true, sport: true, isActive: true },
  });
}

export async function getSiteByTenantKey(
  tenantKey: string,
): Promise<WebsiteSiteRow | null> {
  return prisma.websiteSite.findUnique({
    where: { tenantKey },
    select: { id: true, tenantKey: true, name: true, locale: true, sport: true, isActive: true },
  });
}

export async function getWebsitePages(
  siteId: string,
): Promise<WebsitePageRow[]> {
  return prisma.websitePage.findMany({
    where: { siteId },
    orderBy: [{ sortOrder: "asc" }, { pageType: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      locale: true,
      status: true,
      sortOrder: true,
      isVisible: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export async function getPublishedSnapshots(tenantKey: string) {
  return prisma.websitePublishSnapshot.findMany({
    where: { tenantKey },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      locale: true,
      pageType: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      publishedAt: true,
    },
  });
}

export async function getPublishedSnapshot(
  tenantKey: string,
  slug: string,
  locale: string,
) {
  return prisma.websitePublishSnapshot.findFirst({
    where: { tenantKey, slug, locale },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      locale: true,
      pageType: true,
      title: true,
      blocksJson: true,
      metaTitle: true,
      metaDescription: true,
      publishedAt: true,
    },
  });
}
