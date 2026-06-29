/**
 * lib/navigation/public-nav-feed.ts
 *
 * Server-side loader for the public navigation API.
 *
 * Returns only items where isVisible=true, ordered by area + parent + sortOrder.
 *
 * Privacy contract:
 *   Never exposes: tenantId, createdAt, updatedAt, visibilityMode.
 *   Only public-safe fields are returned.
 *
 * Called by: GET /api/public/[tenant]/website/navigation
 */

import { prisma } from "@/lib/db/prisma";
import { NAV_AREA, type NavArea } from "./constants";

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/**
 * Single navigation item safe for public API exposure.
 *
 * Intentionally omits: tenantId, createdAt, updatedAt, visibilityMode.
 * The `parentId` is retained so the website can reconstruct hierarchy
 * client-side if needed (it is not a private field).
 */
export type PublicNavItem = {
  id: string;
  parentId: string | null;
  area: string;
  label: string;
  linkType: string;
  href: string | null;
  target: string;
  sortOrder: number;
  children?: PublicNavItem[];
};

export type PublicNavAreaData = {
  header: PublicNavItem[];
  footer: PublicNavItem[];
  utility: PublicNavItem[];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads the public navigation tree for a tenant.
 *
 * Filtering: isVisible = true.
 * Order: area asc, parentId (nulls first), sortOrder asc, createdAt asc.
 *
 * Returns a hierarchical structure grouped by area.
 * Only isVisible=true items are included; hidden children of visible parents
 * are also excluded.
 */
export async function getPublicNavigation(tenantId: string): Promise<PublicNavAreaData> {
  const now = new Date();

  const rows = await prisma.websiteNavItem.findMany({
    where: {
      tenantId,
      isVisible: true,
      // CMS V4.2 scheduling window: only include items whose window, if set, contains now.
      // Items with null visibleFrom/visibleUntil are always shown (no restriction).
      AND: [
        { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
        { OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }] },
      ],
    },
    orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      parentId: true,
      area: true,
      label: true,
      linkType: true,
      href: true,
      target: true,
      sortOrder: true,
      // Privacy: intentionally NOT selecting tenantId, createdAt, updatedAt,
      // visibilityMode, visibleFrom, visibleUntil (scheduling metadata is admin-only).
    },
  });

  // Build trees per area
  const byId = new Map<string, PublicNavItem>();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const areaRoots: Record<string, PublicNavItem[]> = {
    [NAV_AREA.HEADER]: [],
    [NAV_AREA.FOOTER]: [],
    [NAV_AREA.UTILITY]: [],
  };

  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parentNode = row.parentId ? byId.get(row.parentId) : undefined;
    if (parentNode) {
      parentNode.children!.push(node);
    } else {
      const areaKey = row.area as NavArea;
      if (areaRoots[areaKey]) {
        areaRoots[areaKey].push(node);
      }
    }
  }

  // Sort children
  for (const node of byId.values()) {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  return {
    header: areaRoots[NAV_AREA.HEADER],
    footer: areaRoots[NAV_AREA.FOOTER],
    utility: areaRoots[NAV_AREA.UTILITY],
  };
}

/**
 * Returns the flat count of visible navigation items for a tenant.
 */
export async function countPublicNavItems(tenantId: string): Promise<number> {
  const now = new Date();
  return prisma.websiteNavItem.count({
    where: {
      tenantId,
      isVisible: true,
      AND: [
        { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
        { OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }] },
      ],
    },
  });
}
