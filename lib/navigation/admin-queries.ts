/**
 * lib/navigation/admin-queries.ts
 *
 * Admin query layer for WebsiteNavItem management.
 *
 * All queries are tenant-scoped. Callers must verify tenantId from the
 * authenticated session before passing it here.
 *
 * Invariants enforced at this layer:
 *  - All queries filter by tenantId — no cross-tenant access.
 *  - createNavItem / updateNavItem verify parent belongs to same tenant + area.
 *  - Circular parent detection: item cannot be its own ancestor.
 *  - moveNavItem swaps sortOrder within the same parent/area.
 *  - deleteNavItem blocked if the item has children (safe delete only).
 */

import { prisma } from "@/lib/db/prisma";
import {
  NAV_AREA,
  NAV_LINK_TYPE,
  NAV_TARGET,
  NAV_VISIBILITY_MODE,
  type NavArea,
  type NavLinkType,
  type NavTarget,
  type NavVisibilityMode,
} from "./constants";
import { validateNavHref, validateNavLabel, normaliseNavHref } from "./validation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavItemAdminRow = {
  id: string;
  tenantId: string;
  parentId: string | null;
  area: NavArea;
  label: string;
  linkType: NavLinkType;
  href: string | null;
  target: NavTarget;
  sortOrder: number;
  isVisible: boolean;
  visibilityMode: NavVisibilityMode;
  createdAt: Date;
  updatedAt: Date;
};

export type NavItemTree = NavItemAdminRow & {
  /** Hydrated children list (populated by listNavItemsGrouped). */
  children: NavItemTree[];
};

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const adminSelect = {
  id: true,
  tenantId: true,
  parentId: true,
  area: true,
  label: true,
  linkType: true,
  href: true,
  target: true,
  sortOrder: true,
  isVisible: true,
  visibilityMode: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// List — flat, ordered
// ---------------------------------------------------------------------------

/**
 * Returns all navigation items for a tenant, ordered by area + sortOrder.
 * Returns flat list; callers can call buildNavTree() to get the hierarchy.
 */
export async function listNavItems(tenantId: string): Promise<NavItemAdminRow[]> {
  const rows = await prisma.websiteNavItem.findMany({
    where: { tenantId },
    orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows as NavItemAdminRow[];
}

/**
 * Returns navigation items for a tenant grouped by area, each group in tree form.
 * Top-level items are those with parentId = null.
 * Children are nested under their parent.
 */
export async function listNavItemsGrouped(
  tenantId: string,
): Promise<Record<NavArea, NavItemTree[]>> {
  const all = await listNavItems(tenantId);
  return buildNavTreesByArea(all);
}

/**
 * Returns the count of navigation items for a tenant.
 */
export async function countNavItems(tenantId: string): Promise<number> {
  return prisma.websiteNavItem.count({ where: { tenantId } });
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getNavItemById(
  tenantId: string,
  id: string,
): Promise<NavItemAdminRow | null> {
  const row = await prisma.websiteNavItem.findFirst({
    where: { id, tenantId },
    select: adminSelect,
  });
  return row as NavItemAdminRow | null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateNavItemInput = {
  parentId?: string | null;
  area: string;
  label: string;
  linkType: string;
  href?: string | null;
  target?: string;
  sortOrder?: number;
  isVisible?: boolean;
  visibilityMode?: string;
};

export type CreateNavItemError =
  | { code: "VALIDATION"; message: string }
  | { code: "INVALID_AREA"; message: string }
  | { code: "INVALID_LINK_TYPE"; message: string }
  | { code: "INVALID_TARGET"; message: string }
  | { code: "INVALID_VISIBILITY_MODE"; message: string }
  | { code: "PARENT_NOT_FOUND"; message: string }
  | { code: "PARENT_WRONG_AREA"; message: string }
  | { code: "MAX_DEPTH"; message: string };

/**
 * Creates a new navigation item for a tenant.
 * Returns the created item, or a typed error.
 */
export async function createNavItem(
  tenantId: string,
  input: CreateNavItemInput,
): Promise<NavItemAdminRow | CreateNavItemError> {
  // Validate label
  const labelErr = validateNavLabel(input.label);
  if (labelErr) return { code: "VALIDATION", message: labelErr };

  // Validate area
  if (!Object.values(NAV_AREA).includes(input.area as NavArea)) {
    return {
      code: "INVALID_AREA",
      message: `Ungültiger Bereich: ${input.area}. Erlaubt: ${Object.values(NAV_AREA).join(", ")}.`,
    };
  }
  const area = input.area as NavArea;

  // Validate linkType
  if (!Object.values(NAV_LINK_TYPE).includes(input.linkType as NavLinkType)) {
    return {
      code: "INVALID_LINK_TYPE",
      message: `Ungültiger Link-Typ: ${input.linkType}.`,
    };
  }
  const linkType = input.linkType as NavLinkType;

  // Validate target
  const rawTarget = input.target ?? NAV_TARGET.SELF;
  if (!Object.values(NAV_TARGET).includes(rawTarget as NavTarget)) {
    return {
      code: "INVALID_TARGET",
      message: `Ungültiges Ziel: ${rawTarget}. Erlaubt: SELF, BLANK.`,
    };
  }
  const target = rawTarget as NavTarget;

  // Validate visibilityMode
  const rawVisMode = input.visibilityMode ?? NAV_VISIBILITY_MODE.ALWAYS;
  if (!Object.values(NAV_VISIBILITY_MODE).includes(rawVisMode as NavVisibilityMode)) {
    return {
      code: "INVALID_VISIBILITY_MODE",
      message: `Ungültiger Sichtbarkeitsmodus: ${rawVisMode}.`,
    };
  }
  const visibilityMode = rawVisMode as NavVisibilityMode;

  // Validate href
  const href = normaliseNavHref(input.href);
  const hrefErr = validateNavHref(href, linkType);
  if (hrefErr) return { code: "VALIDATION", message: hrefErr };

  // Validate parent
  if (input.parentId) {
    const parent = await prisma.websiteNavItem.findFirst({
      where: { id: input.parentId, tenantId },
      select: { id: true, area: true, parentId: true },
    });
    if (!parent) {
      return { code: "PARENT_NOT_FOUND", message: "Das übergeordnete Element wurde nicht gefunden oder gehört nicht zu diesem Mandanten." };
    }
    if (parent.area !== area) {
      return { code: "PARENT_WRONG_AREA", message: "Das übergeordnete Element muss im gleichen Bereich (area) sein." };
    }
    // Depth check: parent must itself be a top-level item (no grandparent nesting beyond depth 2)
    if (parent.parentId !== null) {
      return { code: "MAX_DEPTH", message: "Maximale Verschachtelungstiefe (2 Ebenen) erreicht." };
    }
  }

  // Determine sort order: append to end if not provided
  const sortOrder =
    input.sortOrder !== undefined
      ? input.sortOrder
      : await getNextSortOrder(tenantId, area, input.parentId ?? null);

  const created = await prisma.websiteNavItem.create({
    data: {
      tenantId,
      parentId: input.parentId ?? null,
      area,
      label: input.label.trim(),
      linkType,
      href,
      target,
      sortOrder,
      isVisible: input.isVisible ?? true,
      visibilityMode,
    },
    select: adminSelect,
  });

  return created as NavItemAdminRow;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateNavItemInput = {
  parentId?: string | null;
  area?: string;
  label?: string;
  linkType?: string;
  href?: string | null;
  target?: string;
  sortOrder?: number;
  isVisible?: boolean;
  visibilityMode?: string;
};

export type UpdateNavItemError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "VALIDATION"; message: string }
  | { code: "INVALID_AREA"; message: string }
  | { code: "INVALID_LINK_TYPE"; message: string }
  | { code: "INVALID_TARGET"; message: string }
  | { code: "INVALID_VISIBILITY_MODE"; message: string }
  | { code: "PARENT_NOT_FOUND"; message: string }
  | { code: "PARENT_WRONG_AREA"; message: string }
  | { code: "CIRCULAR_PARENT"; message: string }
  | { code: "MAX_DEPTH"; message: string };

/**
 * Updates a navigation item.
 * Only fields provided in the input are updated.
 * Returns the updated item, or a typed error.
 */
export async function updateNavItem(
  tenantId: string,
  id: string,
  input: UpdateNavItemInput,
): Promise<NavItemAdminRow | UpdateNavItemError> {
  const existing = await prisma.websiteNavItem.findFirst({
    where: { id, tenantId },
    select: { id: true, area: true, parentId: true, linkType: true, href: true },
  });
  if (!existing) return { code: "NOT_FOUND", message: "Navigationselement nicht gefunden." };

  const area = (input.area ?? existing.area) as NavArea;
  const linkType = (input.linkType ?? existing.linkType) as NavLinkType;

  // Validate area
  if (!Object.values(NAV_AREA).includes(area)) {
    return { code: "INVALID_AREA", message: `Ungültiger Bereich: ${area}.` };
  }

  // Validate linkType
  if (!Object.values(NAV_LINK_TYPE).includes(linkType)) {
    return { code: "INVALID_LINK_TYPE", message: `Ungültiger Link-Typ: ${linkType}.` };
  }

  // Validate label
  if (input.label !== undefined) {
    const labelErr = validateNavLabel(input.label);
    if (labelErr) return { code: "VALIDATION", message: labelErr };
  }

  // Validate target
  if (input.target !== undefined) {
    if (!Object.values(NAV_TARGET).includes(input.target as NavTarget)) {
      return { code: "INVALID_TARGET", message: `Ungültiges Ziel: ${input.target}.` };
    }
  }

  // Validate visibilityMode
  if (input.visibilityMode !== undefined) {
    if (!Object.values(NAV_VISIBILITY_MODE).includes(input.visibilityMode as NavVisibilityMode)) {
      return { code: "INVALID_VISIBILITY_MODE", message: `Ungültiger Sichtbarkeitsmodus: ${input.visibilityMode}.` };
    }
  }

  // Validate href
  const href = "href" in input ? normaliseNavHref(input.href) : (existing.href ?? null);
  const hrefErr = validateNavHref(href, linkType);
  if (hrefErr) return { code: "VALIDATION", message: hrefErr };

  // Validate parent if changing parentId
  const newParentId: string | null | undefined = "parentId" in input ? (input.parentId ?? null) : undefined;
  if (newParentId !== undefined && newParentId !== null) {
    // Circular reference check: newParentId must not be the item itself or a descendant
    if (newParentId === id) {
      return { code: "CIRCULAR_PARENT", message: "Ein Element kann nicht sein eigenes übergeordnetes Element sein." };
    }
    const isDescendant = await isNavItemDescendantOf(tenantId, newParentId, id);
    if (isDescendant) {
      return { code: "CIRCULAR_PARENT", message: "Zirkuläre Eltern-Beziehung: Das übergeordnete Element ist ein Nachkomme dieses Elements." };
    }

    const parent = await prisma.websiteNavItem.findFirst({
      where: { id: newParentId, tenantId },
      select: { id: true, area: true, parentId: true },
    });
    if (!parent) {
      return { code: "PARENT_NOT_FOUND", message: "Das übergeordnete Element wurde nicht gefunden oder gehört nicht zu diesem Mandanten." };
    }
    if (parent.area !== area) {
      return { code: "PARENT_WRONG_AREA", message: "Das übergeordnete Element muss im gleichen Bereich (area) sein." };
    }
    if (parent.parentId !== null) {
      return { code: "MAX_DEPTH", message: "Maximale Verschachtelungstiefe (2 Ebenen) erreicht." };
    }
  }

  const updated = await prisma.websiteNavItem.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.linkType !== undefined ? { linkType: input.linkType } : {}),
      ...("href" in input ? { href } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
      ...(input.visibilityMode !== undefined ? { visibilityMode: input.visibilityMode } : {}),
      ...(newParentId !== undefined ? { parentId: newParentId } : {}),
    },
    select: adminSelect,
  });

  return updated as NavItemAdminRow;
}

// ---------------------------------------------------------------------------
// Toggle visibility
// ---------------------------------------------------------------------------

/**
 * Toggles the isVisible flag for a navigation item.
 * Returns the updated item, or null if not found / different tenant.
 */
export async function toggleNavItemVisibility(
  tenantId: string,
  id: string,
): Promise<NavItemAdminRow | null> {
  const existing = await prisma.websiteNavItem.findFirst({
    where: { id, tenantId },
    select: { id: true, isVisible: true },
  });
  if (!existing) return null;

  const updated = await prisma.websiteNavItem.update({
    where: { id },
    data: { isVisible: !existing.isVisible },
    select: adminSelect,
  });
  return updated as NavItemAdminRow;
}

// ---------------------------------------------------------------------------
// Move (up/down within same parent/area)
// ---------------------------------------------------------------------------

/**
 * Moves a navigation item one position up or down within its parent/area group.
 * Swaps sortOrder values with the adjacent item.
 *
 * Returns the full updated list for the tenant after the swap,
 * or null if the item does not exist or is already at the boundary.
 */
export async function moveNavItem(
  tenantId: string,
  id: string,
  direction: "up" | "down",
): Promise<NavItemAdminRow[] | null> {
  const target = await prisma.websiteNavItem.findFirst({
    where: { id, tenantId },
    select: { id: true, area: true, parentId: true, sortOrder: true },
  });
  if (!target) return null;

  // Get siblings (same area + same parent)
  const siblings = await prisma.websiteNavItem.findMany({
    where: { tenantId, area: target.area, parentId: target.parentId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const idx = siblings.findIndex((s) => s.id === id);
  if (idx < 0) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return null;

  const current = siblings[idx];
  const neighbor = siblings[swapIdx];

  await prisma.$transaction([
    prisma.websiteNavItem.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.websiteNavItem.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  return listNavItems(tenantId);
}

// ---------------------------------------------------------------------------
// Delete (safe — only if no children)
// ---------------------------------------------------------------------------

export type DeleteNavItemError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "HAS_CHILDREN"; message: string };

/**
 * Deletes a navigation item.
 * Blocked if the item has children (returns HAS_CHILDREN error).
 * Returns true on success, or a typed error.
 */
export async function deleteNavItem(
  tenantId: string,
  id: string,
): Promise<true | DeleteNavItemError> {
  const existing = await prisma.websiteNavItem.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return { code: "NOT_FOUND", message: "Navigationselement nicht gefunden." };

  const childCount = await prisma.websiteNavItem.count({
    where: { tenantId, parentId: id },
  });
  if (childCount > 0) {
    return {
      code: "HAS_CHILDREN",
      message: `Dieses Element hat ${childCount} Unterelement${childCount === 1 ? "" : "e"}. Bitte zuerst die Unterelemente löschen oder verschieben.`,
    };
  }

  await prisma.websiteNavItem.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Bootstrap default navigation
// ---------------------------------------------------------------------------

export type DefaultNavEntry = {
  area: NavArea;
  label: string;
  href: string;
  linkType: NavLinkType;
  sortOrder: number;
  target: NavTarget;
};

/**
 * Default navigation items for a new tenant.
 * Only includes routes that are known to exist in the public website.
 */
export const DEFAULT_NAV_ITEMS: DefaultNavEntry[] = [
  // ── Header ────────────────────────────────────────────────────────────────
  { area: NAV_AREA.HEADER, label: "Startseite", href: "/", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 0, target: NAV_TARGET.SELF },
  { area: NAV_AREA.HEADER, label: "News", href: "/news", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 1, target: NAV_TARGET.SELF },
  { area: NAV_AREA.HEADER, label: "Teams", href: "/teams", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 2, target: NAV_TARGET.SELF },
  { area: NAV_AREA.HEADER, label: "Spielplan", href: "/spielplan", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 3, target: NAV_TARGET.SELF },
  { area: NAV_AREA.HEADER, label: "Wochenplan", href: "/wochenplan", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 4, target: NAV_TARGET.SELF },
  { area: NAV_AREA.HEADER, label: "Verein", href: "/verein", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 5, target: NAV_TARGET.SELF },
  // ── Footer ────────────────────────────────────────────────────────────────
  { area: NAV_AREA.FOOTER, label: "Startseite", href: "/", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 0, target: NAV_TARGET.SELF },
  { area: NAV_AREA.FOOTER, label: "News", href: "/news", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 1, target: NAV_TARGET.SELF },
  { area: NAV_AREA.FOOTER, label: "Datenschutz", href: "/datenschutz", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 2, target: NAV_TARGET.SELF },
  { area: NAV_AREA.FOOTER, label: "Impressum", href: "/impressum", linkType: NAV_LINK_TYPE.INTERNAL, sortOrder: 3, target: NAV_TARGET.SELF },
];

/**
 * Bootstraps default navigation items for a tenant.
 * Safe to call only when the tenant has no navigation items.
 * Returns the number of items created, or 0 if items already exist.
 */
export async function bootstrapDefaultNavItems(
  tenantId: string,
): Promise<number> {
  const existing = await countNavItems(tenantId);
  if (existing > 0) return 0;

  await prisma.websiteNavItem.createMany({
    data: DEFAULT_NAV_ITEMS.map((item) => ({
      tenantId,
      area: item.area,
      label: item.label,
      href: item.href,
      linkType: item.linkType,
      sortOrder: item.sortOrder,
      target: item.target,
      isVisible: true,
      visibilityMode: NAV_VISIBILITY_MODE.ALWAYS,
      parentId: null,
    })),
    skipDuplicates: true,
  });

  return DEFAULT_NAV_ITEMS.length;
}

// ---------------------------------------------------------------------------
// Hierarchy helpers
// ---------------------------------------------------------------------------

/**
 * Builds a tree structure from a flat list of nav items, grouped by area.
 * Only top-level items (parentId = null) appear at the root of each area.
 * Child items are nested under their parent.
 */
export function buildNavTreesByArea(
  items: NavItemAdminRow[],
): Record<NavArea, NavItemTree[]> {
  const result: Record<NavArea, NavItemTree[]> = {
    [NAV_AREA.HEADER]: [],
    [NAV_AREA.FOOTER]: [],
    [NAV_AREA.UTILITY]: [],
  };

  const byId = new Map<string, NavItemTree>();
  for (const item of items) {
    byId.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = byId.get(item.id)!;
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(node);
    } else {
      const areaKey = item.area as NavArea;
      if (result[areaKey]) {
        result[areaKey].push(node);
      }
    }
  }

  // Sort children within each parent by sortOrder
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns the next available sortOrder for a given tenant/area/parent group. */
async function getNextSortOrder(
  tenantId: string,
  area: NavArea,
  parentId: string | null,
): Promise<number> {
  const last = await prisma.websiteNavItem.findFirst({
    where: { tenantId, area, parentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return last ? last.sortOrder + 1 : 0;
}

/**
 * Checks whether `candidateAncestorId` is a descendant of `rootId`.
 * Used to prevent circular parent references.
 */
async function isNavItemDescendantOf(
  tenantId: string,
  candidateAncestorId: string,
  rootId: string,
): Promise<boolean> {
  let currentId: string | null = candidateAncestorId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (visited.has(currentId)) break; // Cycle detected — bail
    if (currentId === rootId) return true;
    visited.add(currentId);

    const item: { parentId: string | null } | null = await prisma.websiteNavItem.findFirst({
      where: { id: currentId, tenantId },
      select: { parentId: true },
    });
    currentId = item?.parentId ?? null;
  }

  return false;
}
