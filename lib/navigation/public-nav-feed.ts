/**
 * Public navigation feed for GET /api/public/v1/website/navigation.
 *
 * Design invariants (V1.1):
 * - Only isVisible = true items are returned.
 * - PAGE items with a non-PUBLISHED linked page are silently dropped.
 * - Internal fields (tenantId, navigationId, pageId) are never returned.
 * - Both MAIN and FOOTER groups are returned in one response.
 * - Parent items may be grouping-only (url = null); they appear if they have
 *   at least one visible child that resolves to a URL.
 * - Grouping-only parents with no qualifying visible children are omitted.
 * - Children of hidden parents are excluded (parent filter comes first).
 * - Children cannot have children (max 2 levels enforced at API layer).
 */

import { prisma } from "@/lib/db/prisma";

// ── Public types ──────────────────────────────────────────────────────────────

export type PublicNavItem = {
  label: string;
  url: string | null;
  opensInNewTab: boolean;
  children: PublicNavItem[];
};

export type PublicNavigation = {
  main: PublicNavItem[];
  footer: PublicNavItem[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const itemSelect = {
  id: true,
  label: true,
  itemType: true,
  url: true,
  parentId: true,
  isVisible: true,
  opensInNewTab: true,
  sortOrder: true,
  page: {
    select: { slug: true, status: true },
  },
} as const;

type RawItem = {
  id: string;
  label: string;
  itemType: string;
  url: string | null;
  parentId: string | null;
  isVisible: boolean;
  opensInNewTab: boolean;
  sortOrder: number;
  page: { slug: string; status: string } | null;
};

/** Resolves the public URL for an item. Returns null if item should be dropped as a leaf. */
function resolveUrl(item: RawItem): string | null {
  if (item.itemType === "PAGE") {
    // Drop PAGE items where the linked page is not PUBLISHED
    if (!item.page || item.page.status !== "PUBLISHED") return null;
    return `/${item.page.slug}`;
  }
  // CUSTOM_URL or EXTERNAL_URL — url may be null for grouping-only parents
  return item.url ?? null;
}

/**
 * Recursively builds public nav items for items sharing a given parentId.
 *
 * For top-level items (parentId = null):
 *   - Items with a URL are returned directly.
 *   - Grouping-only items (url = null) are returned only if they have ≥1 visible child.
 *
 * For child items (parentId = <string>):
 *   - Only items with a resolvable URL are returned (grouping-only children not supported).
 */
function buildPublicItems(rawItems: RawItem[], parentId: string | null): PublicNavItem[] {
  const result: PublicNavItem[] = [];

  for (const item of rawItems) {
    if (item.parentId !== parentId || !item.isVisible) continue;

    const url = resolveUrl(item);
    const children = buildPublicItems(rawItems, item.id);

    // Grouping-only parent: include only if it has qualifying children
    if (url === null) {
      if (children.length > 0) {
        result.push({ label: item.label, url: null, opensInNewTab: false, children });
      }
      continue;
    }

    result.push({ label: item.label, url, opensInNewTab: item.opensInNewTab, children });
  }

  return result;
}

async function fetchNavItems(tenantId: string, navKey: "MAIN" | "FOOTER"): Promise<RawItem[]> {
  const nav = await prisma.websiteNavigation.findUnique({
    where: { tenantId_key: { tenantId, key: navKey } },
    select: {
      items: {
        where: { isVisible: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: itemSelect,
      },
    },
  });

  return (nav?.items ?? []) as unknown as RawItem[];
}

// ── Public query ──────────────────────────────────────────────────────────────

export async function getPublicNavigation(tenantId: string): Promise<PublicNavigation> {
  const [mainItems, footerItems] = await Promise.all([
    fetchNavItems(tenantId, "MAIN"),
    fetchNavItems(tenantId, "FOOTER"),
  ]);

  return {
    main: buildPublicItems(mainItems, null),
    footer: buildPublicItems(footerItems, null),
  };
}
