/**
 * Website Navigation — Admin query layer.
 *
 * All queries are tenant-scoped. Two navigation groups exist per tenant:
 * MAIN and FOOTER. Groups are auto-created (upserted) on first access.
 *
 * V1.1: parentId is used for one level of nesting (parent → children).
 *   - Children have parentId set to a top-level item's id.
 *   - sortOrder is scoped per parent group (null = top-level, id = children of that parent).
 *   - Max depth: 2 levels (parent + child). Children cannot have children.
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavKey = "MAIN" | "FOOTER";
export type NavItemType = "PAGE" | "CUSTOM_URL" | "EXTERNAL_URL";

export type NavPageSnippet = {
  id: string;
  slug: string;
  title: string;
  status: string;
} | null;

export type NavItemAdminRow = {
  id: string;
  navigationId: string;
  label: string;
  itemType: NavItemType;
  url: string | null;
  pageId: string | null;
  sortOrder: number;
  parentId: string | null;
  isVisible: boolean;
  opensInNewTab: boolean;
  createdAt: Date;
  updatedAt: Date;
  page: NavPageSnippet;
};

export type NavItemAdminRowWithChildren = NavItemAdminRow & {
  children: NavItemAdminRow[];
};

export type NavGroupAdmin = {
  id: string;
  tenantId: string;
  key: NavKey;
  label: string;
  createdAt: Date;
  updatedAt: Date;
  items: NavItemAdminRow[];
};

export type NavGroupAdminWithHierarchy = Omit<NavGroupAdmin, "items"> & {
  topLevel: NavItemAdminRowWithChildren[];
};

// ── Select shapes ─────────────────────────────────────────────────────────────

const pageSnippetSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
} as const;

const itemSelect = {
  id: true,
  navigationId: true,
  label: true,
  itemType: true,
  url: true,
  pageId: true,
  sortOrder: true,
  parentId: true,
  isVisible: true,
  opensInNewTab: true,
  createdAt: true,
  updatedAt: true,
  page: { select: pageSnippetSelect },
} as const;

const NAV_LABELS: Record<NavKey, string> = {
  MAIN: "Hauptnavigation",
  FOOTER: "Footer-Navigation",
};

// ── Upsert / ensure navigation group exists ───────────────────────────────────

async function ensureNavGroup(
  tenantId: string,
  key: NavKey,
): Promise<{ id: string }> {
  return prisma.websiteNavigation.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, label: NAV_LABELS[key] },
    update: {},
    select: { id: true },
  });
}

// ── List / get ────────────────────────────────────────────────────────────────

export async function getNavGroupAdmin(
  tenantId: string,
  key: NavKey,
): Promise<NavGroupAdmin> {
  await ensureNavGroup(tenantId, key);

  const row = await prisma.websiteNavigation.findUniqueOrThrow({
    where: { tenantId_key: { tenantId, key } },
    select: {
      id: true,
      tenantId: true,
      key: true,
      label: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: itemSelect,
      },
    },
  });

  return row as unknown as NavGroupAdmin;
}

/**
 * Returns the navigation group with top-level items populated with their children.
 * Top-level items have parentId = null.
 * Children are sorted by sortOrder within the parent.
 */
export async function getNavGroupAdminWithHierarchy(
  tenantId: string,
  key: NavKey,
): Promise<NavGroupAdminWithHierarchy> {
  const group = await getNavGroupAdmin(tenantId, key);

  const allItems = group.items as NavItemAdminRow[];
  const topLevel = allItems
    .filter((i) => i.parentId === null)
    .map((parent) => ({
      ...parent,
      children: allItems
        .filter((i) => i.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.valueOf() - b.createdAt.valueOf()),
    }));

  return {
    id: group.id,
    tenantId: group.tenantId,
    key: group.key,
    label: group.label,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    topLevel,
  };
}

export async function getAllNavGroupsAdmin(
  tenantId: string,
): Promise<{ main: NavGroupAdmin; footer: NavGroupAdmin }> {
  const [main, footer] = await Promise.all([
    getNavGroupAdmin(tenantId, "MAIN"),
    getNavGroupAdmin(tenantId, "FOOTER"),
  ]);
  return { main, footer };
}

// ── Create item ───────────────────────────────────────────────────────────────

export type CreateNavItemInput = {
  tenantId: string;
  navigationId: string;
  label: string;
  itemType: NavItemType;
  url?: string | null;
  pageId?: string | null;
  parentId?: string | null;
  isVisible?: boolean;
  opensInNewTab?: boolean;
};

export async function createNavItem(
  input: CreateNavItemInput,
): Promise<NavItemAdminRow> {
  // sortOrder is scoped to siblings (same parentId)
  const last = await prisma.websiteNavigationItem.findFirst({
    where: {
      navigationId: input.navigationId,
      parentId: input.parentId ?? null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const row = await prisma.websiteNavigationItem.create({
    data: {
      tenantId: input.tenantId,
      navigationId: input.navigationId,
      label: input.label,
      itemType: input.itemType,
      url: input.url ?? null,
      pageId: input.pageId ?? null,
      sortOrder,
      parentId: input.parentId ?? null,
      isVisible: input.isVisible ?? true,
      opensInNewTab: input.opensInNewTab ?? false,
    },
    select: itemSelect,
  });

  return row as unknown as NavItemAdminRow;
}

// ── Update item ───────────────────────────────────────────────────────────────

export type UpdateNavItemInput = {
  label?: string;
  itemType?: NavItemType;
  url?: string | null;
  pageId?: string | null;
  parentId?: string | null;
  isVisible?: boolean;
  opensInNewTab?: boolean;
  sortOrder?: number;
};

export async function updateNavItem(
  tenantId: string,
  id: string,
  input: UpdateNavItemInput,
): Promise<NavItemAdminRow | null> {
  const existing = await prisma.websiteNavigationItem.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.itemType !== undefined) data.itemType = input.itemType;
  if (input.url !== undefined) data.url = input.url;
  if (input.pageId !== undefined) {
    data.page = input.pageId ? { connect: { id: input.pageId } } : { disconnect: true };
  }
  if (input.parentId !== undefined) {
    data.parent = input.parentId
      ? { connect: { id: input.parentId } }
      : { disconnect: true };
  }
  if (input.isVisible !== undefined) data.isVisible = input.isVisible;
  if (input.opensInNewTab !== undefined) data.opensInNewTab = input.opensInNewTab;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const row = await prisma.websiteNavigationItem.update({
    where: { id },
    data,
    select: itemSelect,
  });
  return row as unknown as NavItemAdminRow;
}

// ── Delete item ───────────────────────────────────────────────────────────────

export async function deleteNavItem(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websiteNavigationItem.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websiteNavigationItem.delete({ where: { id } });
  return true;
}

// ── Reorder items ─────────────────────────────────────────────────────────────

/**
 * Atomically reassigns sortOrder for a set of sibling items.
 *
 * @param tenantId   - Tenant scope
 * @param navigationId - Navigation group scope
 * @param orderedIds - IDs in new order; must all share the same parentId
 * @param parentId   - null for top-level items, string for children of a parent
 */
export async function reorderNavItems(
  tenantId: string,
  navigationId: string,
  orderedIds: string[],
  parentId: string | null = null,
): Promise<void> {
  // Verify all IDs belong to this tenant + navigation + same parent
  const existing = await prisma.websiteNavigationItem.findMany({
    where: { navigationId, tenantId, parentId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((r: { id: string }) => r.id));
  const allValid = orderedIds.every((id) => existingIds.has(id));
  if (!allValid) return;

  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.websiteNavigationItem.update({
        where: { id },
        data: { sortOrder: idx },
      }),
    ),
  );
}
