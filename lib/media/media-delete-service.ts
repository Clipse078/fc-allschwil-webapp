/**
 * lib/media/media-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — MediaAsset permanent hard-delete service.
 *
 * Storage deletion capability: `deleteMediaBlob(url)` exists in
 * lib/media/upload.ts and uses Vercel Blob `del(url)`. Blob deletion
 * is best-effort (non-fatal) — the service always deletes the DB row
 * even if the blob delete fails, logging the failure only.
 *
 * CASCADE BEHAVIOR (automatic via Prisma schema onDelete):
 *   • MediaAssetTag — Cascade (tag associations deleted)
 *   • MediaAssetUsage — Cascade (usage-tracking rows deleted)
 *   • NewsArticleMedia — Cascade (inline article references deleted)
 *   • NewsArticle.heroMediaId — SetNull (article preserved, hero reference nulled)
 *
 * Authorization: WEBSITE_DELETE (TENANT scope) — media is web content.
 */

import { prisma } from "@/lib/db/prisma";
import { deleteMediaBlob } from "./upload";

export type MediaAssetDeletionImpact = {
  filename: string;
  url: string;
  sizeBytes: number;
  /** Whether the blob will be deleted from storage */
  blobWillBeDeleted: boolean;
  /** NewsArticle rows using this as hero image — heroMediaId will be nulled (SetNull) */
  newsArticleHeroRefs: number;
  /** NewsArticleMedia rows (inline usage) — will be cascade-deleted */
  newsArticleMediaRefs: number;
  /** MediaAssetUsage tracking rows — will be cascade-deleted */
  usageRefs: number;
};

export type MediaAssetDeletionResult = {
  assetId: string;
  filename: string;
  blobDeleted: boolean;
  impact: MediaAssetDeletionImpact;
};

/**
 * Returns the deletion impact for a MediaAsset within the given tenant.
 * Returns null when the asset does not exist or belongs to a different tenant.
 * Never mutates.
 */
export async function getMediaAssetDeletionImpact(
  tenantId: string,
  assetId: string,
): Promise<MediaAssetDeletionImpact | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      tenantId: true,
      filename: true,
      url: true,
      sizeBytes: true,
      _count: {
        select: {
          newsArticles: true,
          newsArticleMedia: true,
          usages: true,
        },
      },
    },
  });

  if (!asset || asset.tenantId !== tenantId) return null;

  return {
    filename: asset.filename,
    url: asset.url,
    sizeBytes: asset.sizeBytes,
    blobWillBeDeleted: true,
    newsArticleHeroRefs: asset._count.newsArticles,
    newsArticleMediaRefs: asset._count.newsArticleMedia,
    usageRefs: asset._count.usages,
  };
}

/**
 * Permanently deletes a MediaAsset within the given tenant.
 *
 * Steps:
 *   1. Delete DB record (cascade: MediaAssetTag, MediaAssetUsage, NewsArticleMedia)
 *      (SetNull: NewsArticle.heroMediaId — articles preserved)
 *   2. Best-effort blob deletion via deleteMediaBlob(url)
 *      Non-fatal: DB record is always removed even if blob deletion fails.
 *
 * Returns null when the asset does not exist in the tenant (idempotent-safe).
 */
export async function deleteMediaAssetPermanently(
  tenantId: string,
  assetId: string,
): Promise<MediaAssetDeletionResult | null> {
  const impact = await getMediaAssetDeletionImpact(tenantId, assetId);
  if (impact === null) return null;

  // Delete the DB record first. Cascade/SetNull handles related rows.
  await prisma.mediaAsset.delete({ where: { id: assetId } });

  // Best-effort blob deletion (non-fatal — blob may already be gone).
  let blobDeleted = false;
  try {
    await deleteMediaBlob(impact.url);
    blobDeleted = true;
  } catch {
    // deleteMediaBlob is already non-fatal internally; belt-and-suspenders.
    blobDeleted = false;
  }

  return {
    assetId,
    filename: impact.filename,
    blobDeleted,
    impact,
  };
}
