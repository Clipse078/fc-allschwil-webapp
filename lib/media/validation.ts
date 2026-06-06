/**
 * Media Asset Validation — provider-agnostic, pure functions.
 *
 * Covers all asset types for the Media Library:
 *   - Images: jpg, jpeg, png, webp
 *   - Documents: pdf
 *
 * Videos are embeds only (YouTube/Vimeo) — no video file uploads.
 *
 * Magic-byte verification is performed at the storage layer before any
 * bytes are written. This module provides first-pass (MIME + size) checks
 * suitable for both server-side and client-side use.
 */

import type { MediaAssetType } from "@prisma/client";

// ── Allowed upload MIME types ─────────────────────────────────────────────────

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

// ── File size limits ──────────────────────────────────────────────────────────

/** Maximum image file size: 10 MB */
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum document file size: 20 MB */
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ── MIME → asset type map ─────────────────────────────────────────────────────

const MIME_TO_ASSET_TYPE: Record<AllowedMediaMimeType, MediaAssetType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "application/pdf": "DOCUMENT",
};

const MIME_TO_EXT: Record<AllowedMediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// ── Guards ────────────────────────────────────────────────────────────────────

export function isAllowedMediaMimeType(mime: string): mime is AllowedMediaMimeType {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime);
}

export function mimeToAssetType(mime: string): MediaAssetType | null {
  if (!isAllowedMediaMimeType(mime)) return null;
  return MIME_TO_ASSET_TYPE[mime];
}

export function mimeToExtension(mime: string): string | null {
  if (!isAllowedMediaMimeType(mime)) return null;
  return MIME_TO_EXT[mime];
}

function maxSizeForMime(mime: string): number {
  if (isAllowedMediaMimeType(mime) && MIME_TO_ASSET_TYPE[mime] === "DOCUMENT") {
    return MAX_DOCUMENT_FILE_SIZE_BYTES;
  }
  return MAX_IMAGE_FILE_SIZE_BYTES;
}

// ── File validation ───────────────────────────────────────────────────────────

export type MediaUploadValidationResult =
  | { ok: true; mimeType: AllowedMediaMimeType; ext: string; assetType: MediaAssetType }
  | { ok: false; error: string };

/**
 * First-pass validation for a media file.
 * Server MUST additionally perform magic-byte inspection before writing to storage.
 */
export function validateMediaUploadFile(file: File): MediaUploadValidationResult {
  if (!isAllowedMediaMimeType(file.type)) {
    const allowed = ALLOWED_MEDIA_MIME_TYPES.join(", ");
    return {
      ok: false,
      error: `Ungültiger Dateityp "${file.type || "(unbekannt)"}". Erlaubt: ${allowed}.`,
    };
  }

  const maxSize = maxSizeForMime(file.type);
  if (file.size > maxSize) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = (maxSize / 1024 / 1024).toFixed(0);
    return {
      ok: false,
      error: `Datei zu gross (${mb} MB). Maximum: ${maxMb} MB.`,
    };
  }

  return {
    ok: true,
    mimeType: file.type as AllowedMediaMimeType,
    ext: MIME_TO_EXT[file.type as AllowedMediaMimeType],
    assetType: MIME_TO_ASSET_TYPE[file.type as AllowedMediaMimeType],
  };
}

/**
 * Safe, filesystem-friendly filename stem from an arbitrary string.
 * Strips specials, collapses to hyphens, lowercases. Fallback: "asset".
 */
export function safeStem(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

/** Validates that a focal point value is in range 0–100. */
export function isValidFocalPoint(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
