/**
 * lib/website-config/queries.ts
 *
 * Query helpers for WebsiteConfig — the per-tenant website configuration model.
 * Introduced in CMS V4.2 (Website Platform UX Unification).
 *
 * Design:
 *  - One WebsiteConfig per Tenant, enforced by unique constraint on tenantId.
 *  - Reads use upsert so the config is lazily created with safe defaults.
 *  - All fields are nullable; the UI layer applies defaults when rendering.
 *  - Writes are partial (PATCH semantics); only provided fields are updated.
 */

import { prisma } from "@/lib/db/prisma";

// ── Shape ─────────────────────────────────────────────────────────────────────

export type WebsiteConfigData = {
  id: string;
  tenantId: string;
  // General
  siteName: string | null;
  siteDescription: string | null;
  siteUrl: string | null;
  contactEmail: string | null;
  // SEO
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  canonicalUrl: string | null;
  // Social
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  twitterCard: string | null;
  // Analytics
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  facebookPixelId: string | null;
  plausibleDomain: string | null;
  // Technical
  customHeadHtml: string | null;
  customBodyHtml: string | null;
  maintenanceMode: boolean;
  maintenanceMsg: string | null;
  // PWA
  pwaEnabled: boolean;
  pwaName: string | null;
  pwaShortName: string | null;
  pwaThemeColor: string | null;
  // Cookie
  cookieEnabled: boolean;
  cookieBannerText: string | null;
  cookiePolicyUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const configSelect = {
  id: true,
  tenantId: true,
  siteName: true,
  siteDescription: true,
  siteUrl: true,
  contactEmail: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  robotsIndex: true,
  robotsFollow: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImageUrl: true,
  twitterHandle: true,
  twitterCard: true,
  googleAnalyticsId: true,
  googleTagManagerId: true,
  facebookPixelId: true,
  plausibleDomain: true,
  customHeadHtml: true,
  customBodyHtml: true,
  maintenanceMode: true,
  maintenanceMsg: true,
  pwaEnabled: true,
  pwaName: true,
  pwaShortName: true,
  pwaThemeColor: true,
  cookieEnabled: true,
  cookieBannerText: true,
  cookiePolicyUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Get or create ─────────────────────────────────────────────────────────────

/**
 * Returns the WebsiteConfig for a tenant, creating it if it doesn't exist.
 * Safe to call on every GET request (upsert with empty create = lazy init).
 */
export async function getOrCreateWebsiteConfig(tenantId: string): Promise<WebsiteConfigData> {
  return prisma.websiteConfig.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
    select: configSelect,
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateWebsiteConfigInput = Partial<Omit<WebsiteConfigData, "id" | "tenantId" | "createdAt" | "updatedAt">>;

export async function updateWebsiteConfig(
  tenantId: string,
  input: UpdateWebsiteConfigInput,
): Promise<WebsiteConfigData> {
  return prisma.websiteConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...input },
    update: input,
    select: configSelect,
  });
}
