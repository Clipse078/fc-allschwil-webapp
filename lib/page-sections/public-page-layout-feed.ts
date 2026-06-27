/**
 * lib/page-sections/public-page-layout-feed.ts
 *
 * Server-side loader for the public page layout API (CMS V2 Slice 8).
 *
 * Returns a published page together with its enabled sections.
 *
 * Public visibility rules:
 *   Page gate:    WebsitePage.status = "PUBLISHED" AND publishedAt <= now()
 *   Section gate: WebsitePageSection.isEnabled = true
 *
 * Never exposes: tenantId, createdAt, updatedAt, isEnabled, status.
 * Config is projected through the block registry's public-safe projection.
 * Approval / workflow fields are never on public DTOs.
 *
 * Called by: GET /api/public/[tenant]/website/pages/[slug]/layout
 */

import { prisma } from "@/lib/db/prisma";
import {
  getPublicBlockMeta,
  projectBlockPublicConfig,
  type PublicBlockMeta,
} from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Public DTOs
// ---------------------------------------------------------------------------

export type PublicPageLayoutSection = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  config: Record<string, unknown>;
  block: PublicBlockMeta | null;
};

export type PublicPageLayoutPage = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
};

export type PublicPageLayout = {
  page: PublicPageLayoutPage;
  sections: PublicPageLayoutSection[];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads a published page with its enabled sections for a tenant.
 *
 * Returns null if the page does not exist, belongs to a different tenant,
 * or is not published.
 */
export async function getPublicPageLayout(
  tenantId: string,
  slug: string,
): Promise<PublicPageLayout | null> {
  const now = new Date();

  const page = await prisma.websitePage.findFirst({
    where: {
      tenantId,
      slug,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      sections: {
        where: { isEnabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          label: true,
          sortOrder: true,
          config: true,
        },
      },
    },
  });

  if (!page) return null;

  const sections: PublicPageLayoutSection[] = page.sections.map((s) => {
    const rawConfig =
      s.config !== null && typeof s.config === "object"
        ? (s.config as Record<string, unknown>)
        : {};
    return {
      id: s.id,
      type: s.type,
      label: s.label,
      sortOrder: s.sortOrder,
      config: projectBlockPublicConfig(s.type, rawConfig),
      block: getPublicBlockMeta(s.type),
    };
  });

  return {
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      publishedAt: page.publishedAt,
    },
    sections,
  };
}
