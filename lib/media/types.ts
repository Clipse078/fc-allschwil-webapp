/**
 * Shared types for the Media Library (News CMS V2).
 *
 * MediaAsset is the central model for all tenant-scoped media (images, videos).
 * These types are used by both the admin API routes and the admin UI components.
 */

// ── Allowed MIME types ────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
] as const;

export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];
export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export function isAllowedImageMime(mime: string): mime is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isAllowedVideoMime(mime: string): mime is AllowedVideoMimeType {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime);
}

export function isAllowedMediaMime(mime: string): mime is AllowedMediaMimeType {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime);
}

// ── File size limits ──────────────────────────────────────────────────────────

/** Max image size: 8 MB */
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

/** Max video size: 100 MB */
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export function maxSizeForMime(mime: string): number {
  return isAllowedVideoMime(mime) ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
}

// ── MIME → extension ──────────────────────────────────────────────────────────

const MIME_TO_EXT: Record<AllowedMediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
  "video/mp4":  "mp4",
  "video/webm": "webm",
};

export function mimeToExt(mime: string): string | null {
  if (!isAllowedMediaMime(mime)) return null;
  return MIME_TO_EXT[mime];
}

// ── MediaAsset type strings ───────────────────────────────────────────────────

export type MediaAssetType = "IMAGE" | "VIDEO";

export function mimeToAssetType(mime: string): MediaAssetType {
  return isAllowedVideoMime(mime) ? "VIDEO" : "IMAGE";
}

// ── API response shapes ───────────────────────────────────────────────────────

export type MediaAssetListItem = {
  id: string;
  type: MediaAssetType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  altText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  createdAt: Date;
};

export type MediaAssetDetail = MediaAssetListItem & {
  status: string;
  createdByUserId: string | null;
  updatedAt: Date;
};

// ── Upload validation ─────────────────────────────────────────────────────────

export type MediaUploadValidationResult =
  | { ok: true; mimeType: AllowedMediaMimeType; ext: string; assetType: MediaAssetType }
  | { ok: false; error: string };

export function validateMediaUploadFile(file: File): MediaUploadValidationResult {
  if (!isAllowedMediaMime(file.type)) {
    return {
      ok: false,
      error: `Ungültiger Dateityp "${file.type || "(unbekannt)"}". Erlaubt: JPEG, PNG, WebP, GIF, MP4, WebM.`,
    };
  }

  const maxBytes = maxSizeForMime(file.type);
  if (file.size > maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const limitMb = Math.round(maxBytes / 1024 / 1024);
    return {
      ok: false,
      error: `Datei zu gross (${mb} MB). Maximum für diesen Typ: ${limitMb} MB.`,
    };
  }

  const ext = mimeToExt(file.type)!;
  const assetType = mimeToAssetType(file.type);
  return { ok: true, mimeType: file.type as AllowedMediaMimeType, ext, assetType };
}
