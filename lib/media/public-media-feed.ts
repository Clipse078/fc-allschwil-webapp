/**
 * lib/media/public-media-feed.ts
 *
 * Server-side loader for the public DAM media endpoint.
 *
 * Returns only assets that pass ALL of the following gates:
 *   1. status = "ACTIVE" (not archived)
 *   2. tenantId matches (tenant isolation)
 *
 * Never exposes: storageKey (internal blob reference), createdByUserId,
 * tenantId, folderId, tags, copyright, photographer, description,
 * sizeBytes, type, filename, durationSec, createdAt, updatedAt, archivedAt.
 * Only the fields required for safe public rendering are returned.
 *
 * Called by: GET /api/public/[tenant]/website/media/[id]
 */

import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Public DTO
// ---------------------------------------------------------------------------

export type PublicMediaAsset = {
  id: string;
  /** Publicly accessible CDN / blob URL for the asset. */
  url: string;
  /** Alt text for accessibility (null when not set by editor). */
  altText: string | null;
  /** Optional editorial caption (null when not set). */
  caption: string | null;
  /** Image width in pixels (null for videos or when not stored). */
  width: number | null;
  /** Image height in pixels (null for videos or when not stored). */
  height: number | null;
  /** MIME type, e.g. "image/webp" or "video/mp4". */
  mimeType: string;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads a single active (non-archived) media asset for public use.
 *
 * Returns null when:
 *   - Asset does not exist.
 *   - Asset belongs to a different tenant (tenant isolation).
 *   - Asset is archived (status = "ARCHIVED").
 */
export async function getPublicMediaAsset(
  tenantId: string,
  id: string,
): Promise<PublicMediaAsset | null> {
  const row = await prisma.mediaAsset.findFirst({
    where: {
      id,
      tenantId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      url: true,
      altText: true,
      caption: true,
      width: true,
      height: true,
      mimeType: true,
      // Intentionally excluded: storageKey, createdByUserId, tenantId,
      // folderId, tags, copyright, photographer, description, sizeBytes,
      // type, filename, durationSec, createdAt, updatedAt, archivedAt.
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    url: row.url,
    altText: row.altText,
    caption: row.caption,
    width: row.width,
    height: row.height,
    mimeType: row.mimeType,
  };
}
