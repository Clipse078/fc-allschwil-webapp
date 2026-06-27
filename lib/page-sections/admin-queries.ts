/**
 * lib/page-sections/admin-queries.ts
 *
 * Admin query layer for WebsitePageSection management (CMS V2 Slice 8).
 *
 * All queries are tenant-scoped AND page-scoped. Callers must verify:
 *   - tenantId from the authenticated session (never from request body)
 *   - pageId ownership (page must belong to the same tenant)
 *
 * Publishing strategy (Slice 8 foundation):
 *   Section visibility on the public API requires both:
 *     1. isEnabled = true (section gate)
 *     2. Parent WebsitePage.status = "PUBLISHED" AND publishedAt <= now() (page gate)
 *   Sections have no own publishStatus in this slice. Full section-level
 *   publish/approval workflow is deferred to a future slice.
 *
 * Block type validation is delegated to the API layer (route handlers).
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageSectionAdminItem = {
  id: string;
  tenantId: string;
  pageId: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const adminSelect = {
  id: true,
  tenantId: true,
  pageId: true,
  type: true,
  label: true,
  sortOrder: true,
  isEnabled: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.WebsitePageSectionSelect;

function mapRow(
  row: Prisma.WebsitePageSectionGetPayload<{ select: typeof adminSelect }>,
): PageSectionAdminItem {
  return {
    ...row,
    config:
      row.config !== null && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {},
  };
}

// ---------------------------------------------------------------------------
// Page ownership guard
// ---------------------------------------------------------------------------

/**
 * Verifies that a WebsitePage with the given id belongs to tenantId.
 * Returns the page (id only) if found, null otherwise.
 * Callers must 404 when this returns null.
 */
export async function getPageForTenant(
  tenantId: string,
  pageId: string,
): Promise<{ id: string } | null> {
  return prisma.websitePage.findFirst({
    where: { id: pageId, tenantId },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Returns all sections for a page, ordered by sortOrder ascending then createdAt ascending.
 */
export async function listPageSections(
  tenantId: string,
  pageId: string,
): Promise<PageSectionAdminItem[]> {
  const rows = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

export async function getPageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
): Promise<PageSectionAdminItem | null> {
  const row = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreatePageSectionInput = {
  tenantId: string;
  pageId: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
};

export async function createPageSection(
  input: CreatePageSectionInput,
): Promise<PageSectionAdminItem> {
  // Determine next sortOrder (max + 10)
  const last = await prisma.websitePageSection.findFirst({
    where: { tenantId: input.tenantId, pageId: input.pageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -10) + 10;

  const row = await prisma.websitePageSection.create({
    data: {
      tenantId: input.tenantId,
      pageId: input.pageId,
      type: input.type,
      label: input.label,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      sortOrder,
      isEnabled: true,
    },
    select: adminSelect,
  });
  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Update config / label
// ---------------------------------------------------------------------------

export type UpdatePageSectionInput = {
  label?: string;
  config?: Record<string, unknown>;
};

export async function updatePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  input: UpdatePageSectionInput,
): Promise<PageSectionAdminItem | null> {
  const exists = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true },
  });
  if (!exists) return null;

  const row = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.config !== undefined
        ? { config: input.config as Prisma.InputJsonValue }
        : {}),
    },
    select: adminSelect,
  });
  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Toggle isEnabled
// ---------------------------------------------------------------------------

export async function togglePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
): Promise<PageSectionAdminItem | null> {
  const row = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: adminSelect,
  });
  if (!row) return null;

  const updated = await prisma.websitePageSection.update({
    where: { id: sectionId },
    data: { isEnabled: !row.isEnabled },
    select: adminSelect,
  });
  return mapRow(updated);
}

// ---------------------------------------------------------------------------
// Move (up / down)
// ---------------------------------------------------------------------------

/**
 * Swaps the sortOrder of the given section with its immediate neighbour.
 * Returns the full updated section list after the swap, or null if the
 * section is not found or is already at the boundary.
 */
export async function movePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
  direction: "up" | "down",
): Promise<PageSectionAdminItem[] | null> {
  const all = await prisma.websitePageSection.findMany({
    where: { tenantId, pageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });

  const idx = all.findIndex((s) => s.id === sectionId);
  if (idx === -1) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) {
    // Already at boundary — return current list unchanged
    return all.map(mapRow);
  }

  const current = all[idx];
  const swap = all[swapIdx];

  await prisma.$transaction([
    prisma.websitePageSection.update({
      where: { id: current.id },
      data: { sortOrder: swap.sortOrder },
    }),
    prisma.websitePageSection.update({
      where: { id: swap.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  const updated = await listPageSections(tenantId, pageId);
  return updated;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deletePageSection(
  tenantId: string,
  pageId: string,
  sectionId: string,
): Promise<boolean> {
  const exists = await prisma.websitePageSection.findFirst({
    where: { id: sectionId, tenantId, pageId },
    select: { id: true },
  });
  if (!exists) return false;

  await prisma.websitePageSection.delete({ where: { id: sectionId } });
  return true;
}
