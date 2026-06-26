/**
 * lib/homepage/admin-queries.ts
 *
 * Admin query layer for HomepageSection management.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * This layer intentionally does not validate section type keys —
 * that is the responsibility of the API layer (route handlers).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  type HomepageSectionConfig,
} from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HomepageSectionAdminItem = {
  id: string;
  tenantId: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  config: HomepageSectionConfig;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const adminSelect = {
  id: true,
  tenantId: true,
  type: true,
  label: true,
  sortOrder: true,
  isEnabled: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Returns all homepage sections for a tenant, ordered by sortOrder ascending.
 */
export async function listHomepageSections(
  tenantId: string,
): Promise<HomepageSectionAdminItem[]> {
  const rows = await prisma.homepageSection.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: adminSelect,
  });
  return rows as HomepageSectionAdminItem[];
}

/**
 * Returns the count of homepage sections for a tenant.
 */
export async function countHomepageSections(tenantId: string): Promise<number> {
  return prisma.homepageSection.count({ where: { tenantId } });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Creates the default section set for a tenant.
 * Safe to call only when the tenant has no sections yet.
 * Returns the number of sections created.
 */
export async function bootstrapDefaultSections(
  tenantId: string,
): Promise<number> {
  const existing = await countHomepageSections(tenantId);
  if (existing > 0) return 0;

  await prisma.homepageSection.createMany({
    data: DEFAULT_HOMEPAGE_SECTIONS.map((s) => ({
      tenantId,
      type: s.type,
      label: s.label,
      sortOrder: s.sortOrder,
      isEnabled: s.isEnabled,
      config: s.config,
    })),
    skipDuplicates: true,
  });

  return DEFAULT_HOMEPAGE_SECTIONS.length;
}

// ---------------------------------------------------------------------------
// Toggle enabled/disabled
// ---------------------------------------------------------------------------

/**
 * Toggles the isEnabled flag for a section.
 * Returns the updated section, or null if the section does not exist
 * or belongs to a different tenant.
 */
export async function toggleHomepageSectionEnabled(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true, isEnabled: true },
  });
  if (!existing) return null;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: { isEnabled: !existing.isEnabled },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Reorder (simple up/down)
// ---------------------------------------------------------------------------

/**
 * Moves a section one position up (lower sortOrder) or down (higher sortOrder)
 * relative to its current neighbors.
 *
 * Uses a swap strategy: swaps sortOrder values with the adjacent section.
 * Returns the full updated section list for the tenant after the swap,
 * or null if the section does not exist or is already at the boundary.
 */
export async function moveHomepageSection(
  tenantId: string,
  id: string,
  direction: "up" | "down",
): Promise<HomepageSectionAdminItem[] | null> {
  const sections = await listHomepageSections(tenantId);
  const idx = sections.findIndex((s) => s.id === id);
  if (idx < 0) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sections.length) return null;

  const current = sections[idx];
  const neighbor = sections[swapIdx];

  // Swap sortOrder values in a transaction
  await prisma.$transaction([
    prisma.homepageSection.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.homepageSection.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  return listHomepageSections(tenantId);
}

// ---------------------------------------------------------------------------
// Update label and/or config
// ---------------------------------------------------------------------------

export type HomepageSectionUpdateInput = {
  /** New admin label. Must be non-empty after trimming. */
  label?: string;
  /**
   * Replacement config object. Must have been validated by the caller
   * against the appropriate Zod schema before passing here.
   * Only provided keys are written; existing keys not in the update are
   * replaced entirely (full-replace semantics — no deep merge).
   */
  config?: Record<string, unknown>;
};

/**
 * Updates the label and/or config of a homepage section.
 * Both fields are optional; at least one must be provided.
 *
 * Returns the updated section, or null if the section does not exist
 * or belongs to a different tenant.
 */
export async function updateHomepageSection(
  tenantId: string,
  id: string,
  input: HomepageSectionUpdateInput,
): Promise<HomepageSectionAdminItem | null> {
  const existing = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.homepageSection.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.config !== undefined
        ? { config: input.config as Prisma.InputJsonValue }
        : {}),
    },
    select: adminSelect,
  });
  return updated as HomepageSectionAdminItem;
}

// ---------------------------------------------------------------------------
// Get by ID (tenant-safe)
// ---------------------------------------------------------------------------

export async function getHomepageSectionById(
  tenantId: string,
  id: string,
): Promise<HomepageSectionAdminItem | null> {
  const row = await prisma.homepageSection.findFirst({
    where: { id, tenantId },
    select: adminSelect,
  });
  return row as HomepageSectionAdminItem | null;
}
