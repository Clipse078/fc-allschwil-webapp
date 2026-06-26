/**
 * lib/homepage/public-homepage-feed.ts
 *
 * Server-side loader for the public homepage layout API.
 *
 * Returns only enabled sections, ordered by sortOrder ascending.
 * Never exposes tenantId, createdAt, or updatedAt — only the fields
 * safe for public consumption.
 *
 * Called by: GET /api/public/[tenant]/website/homepage
 */

import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/**
 * Single homepage section safe for public API exposure.
 *
 * Intentionally omits: tenantId, createdAt, updatedAt.
 * config is included — it contains only user-configured display parameters,
 * never internal admin state.
 */
export type PublicHomepageSectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  /**
   * Type-specific display configuration.
   * Consumers should treat unknown keys as ignorable extras.
   */
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads the public homepage section list for a tenant.
 *
 * Filters: isEnabled = true only.
 * Order: sortOrder ascending, then createdAt ascending as tiebreaker.
 */
export async function getPublicHomepageSections(
  tenantId: string,
): Promise<PublicHomepageSectionItem[]> {
  const rows = await prisma.homepageSection.findMany({
    where: { tenantId, isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      label: true,
      sortOrder: true,
      config: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    sortOrder: row.sortOrder,
    config:
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
  }));
}
