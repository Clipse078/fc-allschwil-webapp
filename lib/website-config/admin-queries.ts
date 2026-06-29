/**
 * lib/website-config/admin-queries.ts
 *
 * CMS V4.2 — Website Configuration admin query layer.
 * Single source of truth for WebsiteConfig (1-to-1 with Tenant) and
 * WebsiteRedirect CRUD.
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WebsiteConfigData = {
  id: string;
  tenantId: string;
  // SEO
  seoSiteTitle: string | null;
  seoTitleTemplate: string | null;
  seoDefaultDescription: string | null;
  seoDefaultKeywords: string | null;
  seoCanonicalBase: string | null;
  // Open Graph
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterSite: string | null;
  twitterCardType: string | null;
  // Analytics
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  // Technical
  robotsTxt: string | null;
  sitemapEnabled: boolean;
  faviconUrl: string | null;
  // PWA
  pwaEnabled: boolean;
  pwaName: string | null;
  pwaShortName: string | null;
  pwaThemeColor: string | null;
  pwaBgColor: string | null;
  // Cookie Banner
  cookieBannerEnabled: boolean;
  cookieBannerText: string | null;
  cookieBannerLinkUrl: string | null;
  cookieBannerLinkText: string | null;

  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteRedirectItem = {
  id: string;
  tenantId: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── WebsiteConfig ─────────────────────────────────────────────────────────────

const configSelect = {
  id: true,
  tenantId: true,
  seoSiteTitle: true,
  seoTitleTemplate: true,
  seoDefaultDescription: true,
  seoDefaultKeywords: true,
  seoCanonicalBase: true,
  ogTitle: true,
  ogDescription: true,
  ogImageUrl: true,
  twitterSite: true,
  twitterCardType: true,
  googleAnalyticsId: true,
  googleTagManagerId: true,
  robotsTxt: true,
  sitemapEnabled: true,
  faviconUrl: true,
  pwaEnabled: true,
  pwaName: true,
  pwaShortName: true,
  pwaThemeColor: true,
  pwaBgColor: true,
  cookieBannerEnabled: true,
  cookieBannerText: true,
  cookieBannerLinkUrl: true,
  cookieBannerLinkText: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getWebsiteConfig(
  tenantId: string,
): Promise<WebsiteConfigData | null> {
  const row = await prisma.websiteConfig.findUnique({
    where: { tenantId },
    select: configSelect,
  });
  return row as WebsiteConfigData | null;
}

export async function upsertWebsiteConfig(
  tenantId: string,
  data: Partial<Omit<WebsiteConfigData, "id" | "tenantId" | "createdAt" | "updatedAt">>,
): Promise<WebsiteConfigData> {
  const row = await prisma.websiteConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
    select: configSelect,
  });
  return row as WebsiteConfigData;
}

// ── WebsiteRedirect ───────────────────────────────────────────────────────────

const redirectSelect = {
  id: true,
  tenantId: true,
  fromPath: true,
  toPath: true,
  statusCode: true,
  isActive: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listWebsiteRedirects(
  tenantId: string,
): Promise<WebsiteRedirectItem[]> {
  const rows = await prisma.websiteRedirect.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: redirectSelect,
  });
  return rows as WebsiteRedirectItem[];
}

export async function createWebsiteRedirect(
  tenantId: string,
  data: {
    fromPath: string;
    toPath: string;
    statusCode?: number;
    isActive?: boolean;
    note?: string | null;
  },
): Promise<WebsiteRedirectItem | { error: string }> {
  if (!data.fromPath.startsWith("/")) {
    return { error: "fromPath muss mit / beginnen." };
  }
  try {
    const row = await prisma.websiteRedirect.create({
      data: {
        tenantId,
        fromPath: data.fromPath,
        toPath: data.toPath,
        statusCode: data.statusCode ?? 301,
        isActive: data.isActive ?? true,
        note: data.note ?? null,
      },
      select: redirectSelect,
    });
    return row as WebsiteRedirectItem;
  } catch {
    return { error: "Weiterleitung konnte nicht erstellt werden. Quellpfad ist möglicherweise bereits vergeben." };
  }
}

export async function updateWebsiteRedirect(
  tenantId: string,
  id: string,
  data: Partial<{
    fromPath: string;
    toPath: string;
    statusCode: number;
    isActive: boolean;
    note: string | null;
  }>,
): Promise<WebsiteRedirectItem | null> {
  const existing = await prisma.websiteRedirect.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websiteRedirect.update({
    where: { id },
    data,
    select: redirectSelect,
  });
  return row as WebsiteRedirectItem;
}

export async function deleteWebsiteRedirect(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websiteRedirect.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websiteRedirect.delete({ where: { id } });
  return true;
}
