/**
 * Public navigation feed for GET /api/public/v1/website/navigation.
 *
 * Design invariants:
 * - Only isVisible = true items are returned.
 * - PAGE items with a non-PUBLISHED linked page are silently dropped.
 * - Internal fields (tenantId, navigationId, pageId) are never returned.
 * - Both MAIN and FOOTER groups are returned in one response.
 */

import { prisma } from "@/lib/db/prisma";

// ── Public types ──────────────────────────────────────────────────────────────

export type PublicNavItem = {
  label: string;
  url: string;
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

/** Resolves the public URL for an item. Returns null if item should be dropped. */
function resolveUrl(item: RawItem): string | null {
  if (item.itemType === "PAGE") {
    // Drop PAGE items where the linked page is not PUBLISHED
    if (!item.page || item.page.status !== "PUBLISHED") return null;
    return `/${item.page.slug}`;
  }
  if (item.url) return item.url;
  return null;
}

function buildPublicItems(rawItems: RawItem[], parentId: string | null): PublicNavItem[] {
  return rawItems
    .filter((item) => item.parentId === parentId && item.isVisible)
    .map((item) => {
      const url = resolveUrl(item);
      if (url === null) return null;

      const children = buildPublicItems(rawItems, item.id);

      return {
        label: item.label,
        url,
        opensInNewTab: item.opensInNewTab,
        children,
      } satisfies PublicNavItem;
    })
    .filter((item): item is PublicNavItem => item !== null);
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
