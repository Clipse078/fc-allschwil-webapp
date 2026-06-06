/**
 * Media Library — Prisma query layer.
 *
 * All queries are tenant-scoped. No exceptions.
 * Pagination is simple offset-based for the admin UI.
 */

import { prisma } from "@/lib/db/prisma";
import type { MediaAssetType, MediaAssetStatus } from "@prisma/client";

// ── Select shapes ─────────────────────────────────────────────────────────────

const mediaAssetListSelect = {
  id: true,
  tenantId: true,
  type: true,
  status: true,
  name: true,
  altText: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  storageProvider: true,
  storageKey: true,
  storagePath: true,
  focalX: true,
  focalY: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export type MediaAssetListItem = {
  id: string;
  tenantId: string;
  type: MediaAssetType;
  status: MediaAssetStatus;
  name: string;
  altText: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: string;
  storageKey: string;
  storagePath: string;
  focalX: number | null;
  focalY: number | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; firstName: string; lastName: string } | null;
};

// ── List ──────────────────────────────────────────────────────────────────────

export type ListMediaAssetsInput = {
  tenantId: string;
  type?: MediaAssetType | null;
  status?: MediaAssetStatus | null;
  limit?: number;
  offset?: number;
};

export async function listMediaAssets(
  input: ListMediaAssetsInput,
): Promise<{ assets: MediaAssetListItem[]; total: number }> {
  const where = {
    tenantId: input.tenantId,
    ...(input.type ? { type: input.type } : {}),
    status: input.status ?? ("ACTIVE" as const),
  };

  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  const [assets, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      select: mediaAssetListSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { assets: assets as MediaAssetListItem[], total };
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getMediaAssetById(
  id: string,
  tenantId: string,
): Promise<MediaAssetListItem | null> {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, tenantId },
    select: mediaAssetListSelect,
  });
  return (asset as MediaAssetListItem | null) ?? null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateMediaAssetInput = {
  tenantId: string;
  type: MediaAssetType;
  name: string;
  altText?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: "LOCAL" | "BLOB" | "S3" | "R2";
  storageKey: string;
  storagePath: string;
  focalX?: number | null;
  focalY?: number | null;
  createdById?: string | null;
};

export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetListItem> {
  const asset = await prisma.mediaAsset.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      name: input.name,
      altText: input.altText ?? null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      storagePath: input.storagePath,
      focalX: input.focalX ?? null,
      focalY: input.focalY ?? null,
      createdById: input.createdById ?? null,
    },
    select: mediaAssetListSelect,
  });
  return asset as MediaAssetListItem;
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateMediaAssetInput = {
  name?: string;
  altText?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  status?: MediaAssetStatus;
};

export async function updateMediaAsset(
  id: string,
  tenantId: string,
  input: UpdateMediaAssetInput,
): Promise<MediaAssetListItem | null> {
  const existing = await prisma.mediaAsset.findFirst({ where: { id, tenantId } });
  if (!existing) return null;

  const asset = await prisma.mediaAsset.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.focalX !== undefined ? { focalX: input.focalX } : {}),
      ...(input.focalY !== undefined ? { focalY: input.focalY } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: mediaAssetListSelect,
  });
  return asset as MediaAssetListItem;
}
