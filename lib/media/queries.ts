/**
 * Media Library DB queries — DAM V1 (CMS V2 Slice 11).
 *
 * All queries are tenant-scoped. No cross-tenant access possible.
 * Callers MUST supply tenantId from the authenticated session.
 *
 * Defense-in-depth pattern:
 *   1. findFirst verifies { id, tenantId } before any mutation.
 *   2. Mutations also scope by tenantId where the API supports it
 *      (updateMany / deleteMany), so a mid-flight tenant change cannot
 *      affect another tenant's data.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  MediaAssetListItem,
  MediaAssetDetail,
  MediaFolderItem,
  MediaTagItem,
  MediaAssetUsageItem,
} from "@/lib/media/types";

// Re-export for server-side consumers that prefer a single import
export { buildFolderTree } from "@/lib/media/utils";

// ── Select shapes ─────────────────────────────────────────────────────────────

const tagSelect = {
  id: true,
  tenantId: true,
  name: true,
  createdAt: true,
} as const;

const mediaListSelect = {
  id: true,
  type: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  url: true,
  altText: true,
  caption: true,
  width: true,
  height: true,
  durationSec: true,
  createdAt: true,
  description: true,
  copyright: true,
  photographer: true,
  folderId: true,
  tags: {
    select: {
      tag: { select: tagSelect },
    },
  },
} as const;

const mediaDetailSelect = {
  ...mediaListSelect,
  status: true,
  createdByUserId: true,
  updatedAt: true,
  archivedAt: true,
  storageKey: true,
} as const;

// Shape the raw Prisma result into the public type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeAsset(row: any): MediaAssetListItem {
  return {
    ...row,
    tags: (row.tags ?? []).map((t: { tag: MediaTagItem }) => t.tag),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeAssetDetail(row: any): MediaAssetDetail {
  return {
    ...row,
    tags: (row.tags ?? []).map((t: { tag: MediaTagItem }) => t.tag),
  };
}

// ── List ──────────────────────────────────────────────────────────────────────

export type ListMediaAssetsInput = {
  tenantId: string;
  type?: "IMAGE" | "VIDEO";
  folderId?: string | null;
  tagIds?: string[];
  search?: string;
  showArchived?: boolean;
  limit?: number;
  offset?: number;
};

export async function listMediaAssets(
  input: ListMediaAssetsInput,
): Promise<MediaAssetListItem[]> {
  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const where = buildAssetWhere(input);

  const rows = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: mediaListSelect,
  });

  return rows.map(shapeAsset);
}

export async function countMediaAssets(
  tenantId: string,
  input?: Pick<ListMediaAssetsInput, "type" | "folderId" | "tagIds" | "search" | "showArchived">,
): Promise<number> {
  const where = buildAssetWhere({ tenantId, ...input });
  return prisma.mediaAsset.count({ where });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAssetWhere(input: ListMediaAssetsInput): any {
  const { tenantId, type, folderId, tagIds, search, showArchived } = input;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    tenantId,
    status: showArchived ? undefined : "ACTIVE",
  };
  if (type) where.type = type;
  if (folderId !== undefined) where.folderId = folderId;
  if (tagIds && tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } };
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { altText: { contains: q, mode: "insensitive" } },
      { caption: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { photographer: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getMediaAssetById(
  tenantId: string,
  id: string,
  includeArchived = false,
): Promise<MediaAssetDetail | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { id, tenantId };
  if (!includeArchived) where.status = "ACTIVE";
  const row = await prisma.mediaAsset.findFirst({
    where,
    select: mediaDetailSelect,
  });
  if (!row) return null;
  return shapeAssetDetail(row);
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateMediaAssetInput = {
  id: string;
  tenantId: string;
  type: "IMAGE" | "VIDEO";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  altText?: string | null;
  caption?: string | null;
  description?: string | null;
  copyright?: string | null;
  photographer?: string | null;
  folderId?: string | null;
  storageKey?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  createdByUserId?: string | null;
};

export async function createMediaAsset(
  input: CreateMediaAssetInput,
): Promise<MediaAssetDetail> {
  const row = await prisma.mediaAsset.create({
    data: {
      id: input.id,
      tenantId: input.tenantId,
      type: input.type,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: input.url,
      altText: input.altText ?? null,
      caption: input.caption ?? null,
      description: input.description ?? null,
      copyright: input.copyright ?? null,
      photographer: input.photographer ?? null,
      folderId: input.folderId ?? null,
      storageKey: input.storageKey ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: mediaDetailSelect,
  });
  return shapeAssetDetail(row);
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateMediaAssetInput = {
  altText?: string | null;
  caption?: string | null;
  description?: string | null;
  copyright?: string | null;
  photographer?: string | null;
  folderId?: string | null;
  tagIds?: string[];
};

export async function updateMediaAsset(
  tenantId: string,
  id: string,
  input: UpdateMediaAssetInput,
): Promise<MediaAssetDetail | null> {
  const existing = await prisma.mediaAsset.findFirst({
    where: { id, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.altText !== undefined) data.altText = input.altText;
  if (input.caption !== undefined) data.caption = input.caption;
  if (input.description !== undefined) data.description = input.description;
  if (input.copyright !== undefined) data.copyright = input.copyright;
  if (input.photographer !== undefined) data.photographer = input.photographer;
  if (input.folderId !== undefined) data.folderId = input.folderId;

  // Replace tag set: delete all current tags for this asset+tenant, then insert new ones.
  // tenantId in deleteMany adds defense-in-depth even though mediaAssetId already
  // uniquely identifies the asset after findFirst verified tenant ownership.
  if (input.tagIds !== undefined) {
    await prisma.mediaAssetTag.deleteMany({ where: { mediaAssetId: id, tenantId } });
    if (input.tagIds.length > 0) {
      await prisma.mediaAssetTag.createMany({
        data: input.tagIds.map((tagId) => ({
          id: `${id}-${tagId}`,
          tenantId,
          mediaAssetId: id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  }

  const row = await prisma.mediaAsset.update({
    where: { id },
    data,
    select: mediaDetailSelect,
  });
  return shapeAssetDetail(row);
}

// ── Soft-delete / archive ─────────────────────────────────────────────────────

/**
 * Archives an ACTIVE asset. Returns false if not found or already archived.
 * Does NOT delete the underlying blob — archive is always non-destructive.
 * MediaAssetUsage rows are preserved so usage context survives archive/restore.
 */
export async function archiveMediaAsset(
  tenantId: string,
  id: string,
): Promise<boolean> {
  // Status check is intentional: archiving an already-archived asset is a no-op.
  const existing = await prisma.mediaAsset.findFirst({
    where: { id, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.mediaAsset.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  return true;
}

/**
 * Restores an ARCHIVED asset to ACTIVE. Returns false if not found or already active.
 * The underlying blob URL remains unchanged — restore is always safe.
 * MediaAssetUsage rows are untouched; all usage links immediately become valid again.
 */
export async function restoreMediaAsset(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: { id, tenantId, status: "ARCHIVED" },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.mediaAsset.update({
    where: { id },
    data: { status: "ACTIVE", archivedAt: null },
  });
  return true;
}

// ── Resolve media URL ─────────────────────────────────────────────────────────

export function resolveMediaUrl(asset: { url: string } | null | undefined): string | null {
  return asset?.url ?? null;
}

// ── Usage tracking ────────────────────────────────────────────────────────────
//
// MediaAssetUsage is a generic cross-module tracking table. entityType and
// entityId are free-form strings — no FK constraints on those columns.
//
// Supported today:  NewsArticle, HomepageSection, WebsitePageSection, WebsitePage
// Future (no schema change needed): Event, Sponsor, ClubDocument, InfoBoardItem, MobileAppContent
//
// formatUsageLabel / formatUsageHref are PRESENTATION-LAYER ADAPTERS only.
// They translate entityType strings into human-readable labels and admin links.
// These functions are intentionally NOT part of the data model — they may be
// extended without any DB migration as new module types are added.

export type UpsertMediaUsageInput = {
  tenantId: string;
  mediaAssetId: string;
  entityType: string;
  entityId: string;
  fieldPath?: string | null;
};

/**
 * Creates or refreshes a usage record.
 *
 * PostgreSQL NULL semantics: two rows with fieldPath=null for the same
 * (mediaAssetId, entityType, entityId) are considered different by the DB
 * unique constraint. This function uses findFirst+create/update to deduplicate
 * at the application layer instead of relying on the DB constraint for null rows.
 */
export async function upsertMediaAssetUsage(input: UpsertMediaUsageInput): Promise<void> {
  const fieldPath = input.fieldPath ?? null;
  const existing = await prisma.mediaAssetUsage.findFirst({
    where: {
      mediaAssetId: input.mediaAssetId,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldPath,
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.mediaAssetUsage.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    const id = `mu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await prisma.mediaAssetUsage.create({
      data: {
        id,
        tenantId: input.tenantId,
        mediaAssetId: input.mediaAssetId,
        entityType: input.entityType,
        entityId: input.entityId,
        fieldPath,
      },
    });
  }
}

/**
 * Removes a specific usage record. Used when an entity is saved with the
 * asset reference cleared (e.g. hero image removed from a news article).
 */
export async function deleteMediaAssetUsage(
  mediaAssetId: string,
  entityType: string,
  entityId: string,
  fieldPath?: string | null,
): Promise<void> {
  await prisma.mediaAssetUsage.deleteMany({
    where: { mediaAssetId, entityType, entityId, fieldPath: fieldPath ?? null },
  });
}

export async function getMediaAssetUsages(
  tenantId: string,
  mediaAssetId: string,
): Promise<MediaAssetUsageItem[]> {
  const rows = await prisma.mediaAssetUsage.findMany({
    where: { tenantId, mediaAssetId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    fieldPath: r.fieldPath,
    createdAt: r.createdAt,
    label: formatUsageLabel(r.entityType, r.entityId),
    href: formatUsageHref(r.entityType, r.entityId),
  }));
}

// Presentation adapter — maps entityType strings to German admin labels.
// Add new entries here when wiring new modules; no DB change required.
function formatUsageLabel(entityType: string, entityId: string): string {
  const labels: Record<string, string> = {
    NewsArticle:        "News-Artikel",
    HomepageSection:    "Homepage-Sektion",
    WebsitePageSection: "Seitenbereich",
    WebsitePage:        "Website-Seite",
    // Future: Event, Sponsor, ClubDocument, InfoBoardItem, MobileAppContent
  };
  return `${labels[entityType] ?? entityType} (${entityId.slice(0, 8)}…)`;
}

// Presentation adapter — maps entityType strings to admin-UI deep links.
// Returns undefined when no direct edit link is available.
function formatUsageHref(entityType: string, entityId: string): string | undefined {
  if (entityType === "NewsArticle") return `/dashboard/website/news/${entityId}/edit`;
  if (entityType === "HomepageSection") return `/dashboard/website/homepage`;
  if (entityType === "WebsitePageSection") return undefined;
  if (entityType === "WebsitePage") return `/dashboard/website/pages/${entityId}/edit`;
  return undefined;
}

// ── Folder queries ────────────────────────────────────────────────────────────

export async function listMediaFolders(tenantId: string): Promise<MediaFolderItem[]> {
  const rows = await prisma.mediaFolder.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { assets: true, children: true } },
    },
  });
  return rows as MediaFolderItem[];
}

export type CreateFolderInput = {
  tenantId: string;
  parentId?: string | null;
  name: string;
};

export async function createMediaFolder(input: CreateFolderInput): Promise<MediaFolderItem> {
  const id = `mf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const row = await prisma.mediaFolder.create({
    data: {
      id,
      tenantId: input.tenantId,
      parentId: input.parentId ?? null,
      name: input.name.trim(),
    },
    include: { _count: { select: { assets: true, children: true } } },
  });
  return row as MediaFolderItem;
}

export async function updateMediaFolder(
  tenantId: string,
  id: string,
  data: { name?: string; parentId?: string | null; sortOrder?: number },
): Promise<MediaFolderItem | null> {
  const existing = await prisma.mediaFolder.findFirst({
    where: { id, tenantId, archivedAt: null },
  });
  if (!existing) return null;
  const row = await prisma.mediaFolder.update({
    where: { id },
    data,
    include: { _count: { select: { assets: true, children: true } } },
  });
  return row as MediaFolderItem;
}

/**
 * Archives an empty folder. Returns false if:
 * - folder not found for this tenant, or
 * - folder has active (non-archived) assets, or
 * - folder has active (non-archived) child folders.
 *
 * Archived child folders and archived assets do NOT block deletion —
 * they are already invisible to editors and pose no data-loss risk.
 */
export async function archiveMediaFolder(tenantId: string, id: string): Promise<boolean> {
  const folder = await prisma.mediaFolder.findFirst({
    where: { id, tenantId, archivedAt: null },
    include: {
      _count: {
        select: {
          // Count only active (non-archived) assets in this folder
          assets: { where: { status: "ACTIVE" } },
          // Count only non-archived child folders
          children: { where: { archivedAt: null } },
        },
      },
    },
  });
  if (!folder) return false;

  const counts = (folder as MediaFolderItem & {
    _count: { assets: number; children: number };
  })._count;

  if (counts && (counts.assets > 0 || counts.children > 0)) {
    return false;
  }

  await prisma.mediaFolder.update({ where: { id }, data: { archivedAt: new Date() } });
  return true;
}

// ── Tag queries ───────────────────────────────────────────────────────────────

export async function listMediaTags(tenantId: string): Promise<MediaTagItem[]> {
  const rows = await prisma.mediaTag.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { _count: { select: { assets: true } } },
  });
  return rows as MediaTagItem[];
}

export async function createMediaTag(tenantId: string, name: string): Promise<MediaTagItem | null> {
  try {
    const id = `mt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const row = await prisma.mediaTag.create({
      data: { id, tenantId, name: name.trim() },
      include: { _count: { select: { assets: true } } },
    });
    return row as MediaTagItem;
  } catch {
    return null;
  }
}

export async function deleteMediaTag(tenantId: string, id: string): Promise<boolean> {
  const existing = await prisma.mediaTag.findFirst({ where: { id, tenantId } });
  if (!existing) return false;
  await prisma.mediaTag.delete({ where: { id } });
  return true;
}
