import { prisma } from "@/lib/db/prisma";

export type SiteData = {
  id: string;
  tenantKey: string;
  name: string;
  locale: string;
};

export type NewsArticleListItem = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  listingText: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewsArticleDetailData = NewsArticleListItem & {
  siteId: string;
  body: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
};

export async function getDefaultSite(): Promise<SiteData | null> {
  return prisma.websiteSite.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, tenantKey: true, name: true, locale: true },
  });
}

export async function getNewsAdminListData(siteId: string): Promise<NewsArticleListItem[]> {
  const rows = await prisma.newsArticle.findMany({
    where: { siteId },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      locale: true,
      title: true,
      listingText: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows as NewsArticleListItem[];
}

export async function getNewsArticleDetailData(
  articleId: string,
  siteId: string
): Promise<NewsArticleDetailData | null> {
  const row = await prisma.newsArticle.findFirst({
    where: { id: articleId, siteId },
    select: {
      id: true,
      siteId: true,
      slug: true,
      locale: true,
      title: true,
      listingText: true,
      body: true,
      coverImageUrl: true,
      authorName: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return row as NewsArticleDetailData | null;
}
