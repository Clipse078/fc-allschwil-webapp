import { prisma } from "@/lib/db/prisma";

export type PublicNewsArticleSummary = {
  id: string;
  siteId: string;
  slug: string;
  locale: string;
  title: string;
  listingText: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  publishedAt: Date;
};

export type PublicNewsArticleDetail = PublicNewsArticleSummary & {
  body: string | null;
};

async function resolveSiteId(tenantKey: string): Promise<string | null> {
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true },
  });
  return site?.id ?? null;
}

export async function getPublicNewsArticle(
  tenantKey: string,
  slug: string,
  locale = "de"
): Promise<PublicNewsArticleDetail | null> {
  const siteId = await resolveSiteId(tenantKey);
  if (!siteId) return null;

  const article = await prisma.newsArticle.findFirst({
    where: {
      siteId,
      slug,
      locale,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
    },
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
      publishedAt: true,
    },
  });

  if (!article || !article.publishedAt) {
    return null;
  }

  return {
    ...article,
    publishedAt: article.publishedAt,
  };
}

export async function getPublicNewsList(
  tenantKey: string,
  locale = "de",
  limit = 20
): Promise<PublicNewsArticleSummary[]> {
  const siteId = await resolveSiteId(tenantKey);
  if (!siteId) return [];

  const normalizedLimit = Math.max(1, Math.min(100, limit));

  const articles = await prisma.newsArticle.findMany({
    where: {
      siteId,
      locale,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
    },
    orderBy: { publishedAt: "desc" },
    take: normalizedLimit,
    select: {
      id: true,
      siteId: true,
      slug: true,
      locale: true,
      title: true,
      listingText: true,
      coverImageUrl: true,
      authorName: true,
      publishedAt: true,
    },
  });

  return articles.filter(
    (a): a is PublicNewsArticleSummary & { publishedAt: Date } =>
      a.publishedAt !== null
  );
}
