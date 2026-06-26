/**
 * lib/homepage/public-homepage-feed.ts
 *
 * Server-side loader for the public homepage layout API.
 *
 * Returns only enabled sections, ordered by sortOrder ascending.
 * Never exposes tenantId, createdAt, or updatedAt — only fields safe for
 * public consumption.
 *
 * Each section item includes a `block` field with public-safe block metadata
 * from the block registry (category and datadriven flag). Backwards-compatible
 * addition: existing consumers that don't use `block` will safely ignore it.
 *
 * The section config is projected through the block registry's
 * projectPublicConfig() to ensure no admin-only config fields ever leak to
 * the public API. All current block types pass config through unchanged; the
 * mechanism is in place for future types that may need filtering.
 *
 * Called by: GET /api/public/[tenant]/website/homepage
 */

import { prisma } from "@/lib/db/prisma";
import {
  getPublicBlockMeta,
  projectBlockPublicConfig,
  type PublicBlockMeta,
} from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/**
 * Single homepage section safe for public API exposure.
 *
 * Intentionally omits: tenantId, createdAt, updatedAt, isEnabled.
 * Config is projected through the block registry's public-safe projection.
 *
 * The `block` field carries public-safe block metadata from the registry.
 * It is null for any unregistered type keys (safe fallback for unknown types).
 */
export type PublicHomepageSectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  /**
   * Type-specific display configuration, projected to public-safe fields.
   * Consumers should treat unknown keys as ignorable extras.
   */
  config: Record<string, unknown>;
  /**
   * Public-safe block metadata from the block registry.
   * Null for unregistered type keys.
   * Added in CMS V2 Slice 3 (backwards-compatible).
   */
  block: PublicBlockMeta | null;
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

  return rows.map((row) => {
    const rawConfig =
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {};

    return {
      id: row.id,
      type: row.type,
      label: row.label,
      sortOrder: row.sortOrder,
      config: projectBlockPublicConfig(row.type, rawConfig),
      block: getPublicBlockMeta(row.type),
    };
  });
}
