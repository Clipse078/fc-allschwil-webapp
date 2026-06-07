/**
 * Homepage Blocks — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify the tenantId
 * from the authenticated session before passing it here.
 *
 * Mirrors lib/pages/admin-queries.ts for the HomepageBlock model.
 */

import { prisma } from "@/lib/db/prisma";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BlockStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";

export type BlockType = "HERO";

export type HeroBlockData = {
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type BlockStyling = {
  overlayColor: string | null;
  overlayOpacity: number | null;
  gradientType: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  textColor: string | null;
};

export type HeroMediaSnippet = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
} | null;

export type HomepageBlockAdminItem = {
  id: string;
  type: BlockType;
  sortOrder: number;
  status: BlockStatus;
  title: string;
  data: HeroBlockData;
  heroMediaId: string | null;
  heroMedia: HeroMediaSnippet;
  overlayColor: string | null;
  overlayOpacity: number | null;
  gradientType: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  textColor: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Select shapes ─────────────────────────────────────────────────────────────

const heroMediaSelect = {
  id: true,
  url: true,
  altText: true,
  filename: true,
} as const;

const adminItemSelect = {
  id: true,
  type: true,
  sortOrder: true,
  status: true,
  title: true,
  data: true,
  heroMediaId: true,
  heroMedia: { select: heroMediaSelect },
  overlayColor: true,
  overlayOpacity: true,
  gradientType: true,
  gradientFrom: true,
  gradientTo: true,
  textColor: true,
  publishedAt: true,
  scheduledAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── List ───────────────────────────────────────────────────────────────────────

export type ListHomepageBlocksInput = {
  tenantId: string;
  status?: BlockStatus;
};

export async function listHomepageBlocksAdmin(
  input: ListHomepageBlocksInput,
): Promise<HomepageBlockAdminItem[]> {
  const rows = await prisma.homepageBlock.findMany({
    where: {
      tenantId: input.tenantId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: adminItemSelect,
  });
  return rows as unknown as HomepageBlockAdminItem[];
}

// ── Preview list (all non-ARCHIVED, any status) ───────────────────────────────

export async function listHomepageBlocksPreview(
  tenantId: string,
): Promise<HomepageBlockAdminItem[]> {
  const rows = await prisma.homepageBlock.findMany({
    where: {
      tenantId,
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: adminItemSelect,
  });
  return rows as unknown as HomepageBlockAdminItem[];
}

// ── Detail ─────────────────────────────────────────────────────────────────────

export async function getHomepageBlockAdminById(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const row = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: adminItemSelect,
  });
  if (!row) return null;
  return row as unknown as HomepageBlockAdminItem;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export type CreateHomepageBlockInput = {
  tenantId: string;
  type?: BlockType;
  title: string;
  data?: HeroBlockData;
  heroMediaId?: string | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  gradientType?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  textColor?: string | null;
  scheduledAt?: Date | null;
};

export async function createHomepageBlock(
  input: CreateHomepageBlockInput,
): Promise<HomepageBlockAdminItem> {
  // Determine next sortOrder
  const maxBlock = await prisma.homepageBlock.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextSortOrder = (maxBlock?.sortOrder ?? -1) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    tenantId: input.tenantId,
    type: input.type ?? "HERO",
    sortOrder: nextSortOrder,
    status: "DRAFT",
    title: input.title,
    data: (input.data ?? {}) as object,
    heroMediaId: input.heroMediaId ?? null,
    overlayColor: input.overlayColor ?? null,
    overlayOpacity: input.overlayOpacity ?? null,
    gradientType: input.gradientType ?? null,
    gradientFrom: input.gradientFrom ?? null,
    gradientTo: input.gradientTo ?? null,
    textColor: input.textColor ?? null,
    scheduledAt: input.scheduledAt ?? null,
  };

  const row = await prisma.homepageBlock.create({ data, select: adminItemSelect });
  return row as unknown as HomepageBlockAdminItem;
}

// ── Update ─────────────────────────────────────────────────────────────────────

export type UpdateHomepageBlockInput = {
  title?: string;
  data?: HeroBlockData;
  heroMediaId?: string | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  gradientType?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  textColor?: string | null;
  scheduledAt?: Date | null;
  reviewNotes?: string | null;
};

export async function updateHomepageBlock(
  tenantId: string,
  id: string,
  input: UpdateHomepageBlockInput,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.data !== undefined) updateData.data = input.data as object;
  if (input.heroMediaId !== undefined) updateData.heroMediaId = input.heroMediaId;
  if (input.overlayColor !== undefined) updateData.overlayColor = input.overlayColor;
  if (input.overlayOpacity !== undefined) updateData.overlayOpacity = input.overlayOpacity;
  if (input.gradientType !== undefined) updateData.gradientType = input.gradientType;
  if (input.gradientFrom !== undefined) updateData.gradientFrom = input.gradientFrom;
  if (input.gradientTo !== undefined) updateData.gradientTo = input.gradientTo;
  if (input.textColor !== undefined) updateData.textColor = input.textColor;
  if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
  if (input.reviewNotes !== undefined) updateData.reviewNotes = input.reviewNotes;

  // Auto-transition DRAFT → SCHEDULED when a future scheduledAt is set
  const effectiveScheduledAt =
    input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt;
  if (
    effectiveScheduledAt &&
    effectiveScheduledAt > new Date() &&
    (existing.status === "DRAFT" || existing.status === "IN_REVIEW")
  ) {
    updateData.status = "SCHEDULED";
  }
  if (input.scheduledAt === null && existing.status === "SCHEDULED") {
    updateData.status = "DRAFT";
  }

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: updateData,
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

// ── Publish / Unpublish / Archive ─────────────────────────────────────────────

export async function publishHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isScheduledForFuture = existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      ...(existing.status !== "PUBLISHED" && !isScheduledForFuture
        ? { publishedAt: now }
        : {}),
    },
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

export async function unpublishHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: { status: "DRAFT" },
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

export async function archiveHomepageBlock(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.homepageBlock.update({ where: { id }, data: { status: "ARCHIVED" } });
  return true;
}

// ── Review workflow ────────────────────────────────────────────────────────────

export async function submitHomepageBlockForReview(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (!["DRAFT", "ARCHIVED"].includes(existing.status)) return null;

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: { status: "IN_REVIEW", reviewNotes: null },
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

export async function approveHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isScheduledForFuture = existing.scheduledAt && existing.scheduledAt > now;

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: {
      status: isScheduledForFuture ? "SCHEDULED" : "PUBLISHED",
      reviewNotes: null,
      ...(!isScheduledForFuture ? { publishedAt: now } : {}),
    },
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

export async function rejectHomepageBlock(
  tenantId: string,
  id: string,
  notes?: string | null,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const row = await prisma.homepageBlock.update({
    where: { id },
    data: { status: "DRAFT", reviewNotes: notes ?? null },
    select: adminItemSelect,
  });
  return row as unknown as HomepageBlockAdminItem;
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteHomepageBlock(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.homepageBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.homepageBlock.delete({ where: { id } });
  return true;
}

// ── Reorder ────────────────────────────────────────────────────────────────────

/**
 * Applies a new sort order to a set of blocks by updating each block's
 * sortOrder field. The caller must ensure all IDs belong to the tenant.
 *
 * @param tenantId - Tenant scope guard.
 * @param orderedIds - Array of block IDs in the desired display order.
 */
export async function reorderHomepageBlocks(
  tenantId: string,
  orderedIds: string[],
): Promise<void> {
  // Verify all IDs belong to the tenant
  const existing = await prisma.homepageBlock.findMany({
    where: { tenantId, id: { in: orderedIds } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((b) => b.id));

  await prisma.$transaction(
    orderedIds
      .filter((id) => validIds.has(id))
      .map((id, index) =>
        prisma.homepageBlock.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
  );
}
