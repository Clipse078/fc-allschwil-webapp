/**
 * Media Library DB queries — News CMS V2.
 *
 * All queries are tenant-scoped. No cross-tenant access possible.
 * Callers must verify tenantId from the authenticated session.
 */

import { prisma } from "@/lib/db/prisma";
import type { MediaAssetListItem, MediaAssetDetail } from "@/lib/media/types";

// ── Select shapes ─────────────────────────────────────────────────────────────

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
} as const;

const mediaDetailSelect = {
  ...mediaListSelect,
  status: true,
  createdByUserId: true,
  updatedAt: true,
} as const;

// ── List ──────────────────────────────────────────────────────────────────────

export type ListMediaAssetsInput = {
  tenantId: string;
  type?: "IMAGE" | "VIDEO";
  limit?: number;
  offset?: number;
};

export async function listMediaAssets(
  input: ListMediaAssetsInput,
): Promise<MediaAssetListItem[]> {
  const limit = Math.min(input.limit ?? 50, 200);
  const offset = input.offset ?? 0;

  return prisma.mediaAsset.findMany({
    where: {
      tenantId: input.tenantId,
      status: "ACTIVE",
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: mediaListSelect,
  }) as Promise<MediaAssetListItem[]>;
}

export async function countMediaAssets(
  tenantId: string,
  type?: "IMAGE" | "VIDEO",
): Promise<number> {
  return prisma.mediaAsset.count({
    where: {
      tenantId,
      status: "ACTIVE",
      ...(type ? { type } : {}),
    },
  });
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getMediaAssetById(
  tenantId: string,
  id: string,
): Promise<MediaAssetDetail | null> {
  const row = await prisma.mediaAsset.findFirst({
    where: { id, tenantId, status: "ACTIVE" },
    select: mediaDetailSelect,
  });
  return row as MediaAssetDetail | null;
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
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: mediaDetailSelect,
  });
  return row as MediaAssetDetail;
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateMediaAssetInput = {
  altText?: string | null;
  caption?: string | null;
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

  const row = await prisma.mediaAsset.update({
    where: { id },
    data: {
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
    },
    select: mediaDetailSelect,
  });
  return row as MediaAssetDetail;
}

// ── Soft-delete ───────────────────────────────────────────────────────────────

export async function archiveMediaAsset(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.mediaAsset.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.mediaAsset.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  return true;
}
