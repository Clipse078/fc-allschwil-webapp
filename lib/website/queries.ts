/**
 * Website Feed v1 — Database Queries
 *
 * All queries are tenant-scoped and filter for safe public data only:
 * - Sponsors: publishStatus=PUBLISHED AND isActive=true
 * - News:     publishStatus=PUBLISHED
 *
 * The approvedDataOnly flag on the Tenant record is enforced by the
 * response-builder layer; these queries always use the strict filter
 * so draft/archived data can never leak regardless of config.
 */

import { prisma } from "@/lib/db/prisma";
import type { PublicSponsorItem, PublicNewsItem } from "./response-types";

// ---------------------------------------------------------------------------
// Tenant website config lookup
// ---------------------------------------------------------------------------

export async function getTenantWebsiteConfig(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      websiteEnabled: true,
      approvedDataOnly: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------

export async function getPublishedSponsors(tenantId: string): Promise<PublicSponsorItem[]> {
  const rows = await prisma.sponsor.findMany({
    where: {
      tenantId,
      publishStatus: "PUBLISHED",
      isActive: true,
    },
    orderBy: [
      { tier: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      websiteUrl: true,
      tier: true,
      sortOrder: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    tier: row.tier,
    sortOrder: row.sortOrder,
  }));
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export type GetPublicNewsInput = {
  tenantId: string;
  limit?: number | null;
};

export async function getPublishedNews(input: GetPublicNewsInput): Promise<PublicNewsItem[]> {
  const limit = normalizeNewsLimit(input.limit);

  const rows = await prisma.newsArticle.findMany({
    where: {
      tenantId: input.tenantId,
      publishStatus: "PUBLISHED",
    },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      imageUrl: true,
      publishedAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }));
}

function normalizeNewsLimit(value?: number | null): number {
  if (!value || Number.isNaN(value)) return 20;
  return Math.max(1, Math.min(100, value));
}
