/**
 * Homepage Blocks V1 — Admin query layer.
 *
 * All queries are tenant-scoped. Callers must verify tenantId from session.
 * Mirrors the pattern of lib/news/admin-queries.ts and lib/pages/admin-queries.ts.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  AnyBlockConfig,
  HomepageBlockAdminItem,
  WebsiteBlockStatus,
  WebsiteBlockType,
  WebsitePageContext,
} from "./types";

// ── Select shapes ──────────────────────────────────────────────────────────────

const instanceSelect = {
  id: true,
  enabled: true,
  sortOrder: true,
  pageContext: true,
} as const;

const blockAdminSelect = {
  id: true,
  type: true,
  status: true,
  title: true,
  config: true,
  reviewNotes: true,
  publishedAt: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
  instances: {
    where: { pageContext: "HOMEPAGE" as const },
    select: instanceSelect,
    take: 1,
  },
} as const;

// ── Mapping ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: any): HomepageBlockAdminItem {
  return {
    id: row.id,
    type: row.type as WebsiteBlockType,
    status: row.status as WebsiteBlockStatus,
    title: row.title,
    config: (row.config ?? {}) as AnyBlockConfig,
    reviewNotes: row.reviewNotes ?? null,
    publishedAt: row.publishedAt ? (row.publishedAt as Date).toISOString() : null,
    scheduledAt: row.scheduledAt ? (row.scheduledAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    instance: row.instances?.[0]
      ? {
          id: row.instances[0].id,
          enabled: row.instances[0].enabled,
          sortOrder: row.instances[0].sortOrder,
          pageContext: row.instances[0].pageContext as WebsitePageContext,
        }
      : null,
  };
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listHomepageBlocks(
  tenantId: string,
): Promise<HomepageBlockAdminItem[]> {
  const rows = await prisma.websiteBlock.findMany({
    where: { tenantId },
    select: blockAdminSelect,
    orderBy: [{ createdAt: "asc" }],
  });

  const blocks = rows.map(mapBlock);

  // Sort by instance sortOrder for homepage context; blocks without instance go last
  blocks.sort((a, b) => {
    const aOrder = a.instance?.sortOrder ?? 9999;
    const bOrder = b.instance?.sortOrder ?? 9999;
    return aOrder - bOrder;
  });

  return blocks;
}

export async function countHomepageBlocks(
  tenantId: string,
  status?: WebsiteBlockStatus,
): Promise<number> {
  return prisma.websiteBlock.count({
    where: { tenantId, ...(status ? { status } : {}) },
  });
}

// ── Detail ─────────────────────────────────────────────────────────────────────

export async function getHomepageBlockById(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const row = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: blockAdminSelect,
  });
  if (!row) return null;
  return mapBlock(row);
}

// ── Create ─────────────────────────────────────────────────────────────────────

export type CreateHomepageBlockInput = {
  tenantId: string;
  type: WebsiteBlockType;
  title: string;
  config?: AnyBlockConfig;
};

export async function createHomepageBlock(
  input: CreateHomepageBlockInput,
): Promise<HomepageBlockAdminItem> {
  // Determine next sortOrder for the homepage context
  const maxOrder = await prisma.websiteBlockInstance.findFirst({
    where: { tenantId: input.tenantId, pageContext: "HOMEPAGE" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (maxOrder?.sortOrder ?? -1) + 1;

  // Create block + homepage instance atomically
  const row = await prisma.websiteBlock.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      title: input.title,
      config: (input.config ?? {}) as object,
      status: "DRAFT",
      instances: {
        create: {
          tenantId: input.tenantId,
          pageContext: "HOMEPAGE",
          enabled: true,
          sortOrder: nextOrder,
        },
      },
    },
    select: blockAdminSelect,
  });

  return mapBlock(row);
}

// ── Update ─────────────────────────────────────────────────────────────────────

export type UpdateHomepageBlockInput = {
  title?: string;
  config?: AnyBlockConfig;
  scheduledAt?: Date | null;
  reviewNotes?: string | null;
};

export async function updateHomepageBlock(
  tenantId: string,
  id: string,
  input: UpdateHomepageBlockInput,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.config !== undefined) data.config = input.config as object;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.reviewNotes !== undefined) data.reviewNotes = input.reviewNotes;

  const row = await prisma.websiteBlock.update({
    where: { id },
    data,
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteHomepageBlock(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websiteBlock.delete({ where: { id } });
  return true;
}

// ── Enable / Disable ───────────────────────────────────────────────────────────

export async function setBlockEnabled(
  tenantId: string,
  blockId: string,
  enabled: boolean,
): Promise<boolean> {
  const instance = await prisma.websiteBlockInstance.findFirst({
    where: { tenantId, blockId, pageContext: "HOMEPAGE" },
    select: { id: true },
  });
  if (!instance) return false;
  await prisma.websiteBlockInstance.update({
    where: { id: instance.id },
    data: { enabled },
  });
  return true;
}

// ── Reorder ────────────────────────────────────────────────────────────────────

/** Updates sortOrder for all homepage instances to match orderedBlockIds. */
export async function reorderHomepageBlocks(
  tenantId: string,
  orderedBlockIds: string[],
): Promise<void> {
  await Promise.all(
    orderedBlockIds.map((blockId, idx) =>
      prisma.websiteBlockInstance.updateMany({
        where: { tenantId, blockId, pageContext: "HOMEPAGE" },
        data: { sortOrder: idx },
      }),
    ),
  );
}

// ── Workflow ───────────────────────────────────────────────────────────────────

export async function publishHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const now = new Date();
  const row = await prisma.websiteBlock.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: existing.status !== "PUBLISHED" ? now : undefined,
    },
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

export async function unpublishHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websiteBlock.update({
    where: { id },
    data: { status: "DRAFT" },
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

export async function submitHomepageBlockForReview(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (!["DRAFT", "ARCHIVED"].includes(existing.status)) return null;

  const row = await prisma.websiteBlock.update({
    where: { id },
    data: { status: "IN_REVIEW", reviewNotes: null },
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

export async function approveHomepageBlock(
  tenantId: string,
  id: string,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const now = new Date();
  const row = await prisma.websiteBlock.update({
    where: { id },
    data: { status: "PUBLISHED", reviewNotes: null, publishedAt: now },
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

export async function rejectHomepageBlock(
  tenantId: string,
  id: string,
  notes?: string | null,
): Promise<HomepageBlockAdminItem | null> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.websiteBlock.update({
    where: { id },
    data: { status: "DRAFT", reviewNotes: notes ?? null },
    select: blockAdminSelect,
  });
  return mapBlock(row);
}

export async function archiveHomepageBlock(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.websiteBlock.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.websiteBlock.update({ where: { id }, data: { status: "ARCHIVED" } });
  return true;
}
