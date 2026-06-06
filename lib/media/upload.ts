/**
 * Provider-agnostic Media Upload — News CMS V2 / Shared Media Library.
 *
 * Single upload entry-point for tenant media assets (images, videos).
 * Uses Vercel Blob as the storage backend (same as lib/assets/storage.ts
 * for logos) but with a distinct key namespace and broader MIME support.
 *
 * Key convention:
 *   media/{tenantKey}/{assetId}.{ext}
 *
 * This function does NOT write to lib/assets/storage.ts — branding logo
 * upload is intentionally kept separate. Do not merge the two paths.
 *
 * Returns { ok: false, status: 503 } when BLOB_READ_WRITE_TOKEN is absent.
 */

import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import {
  isAllowedMediaMime,
  mimeToExt,
  mimeToAssetType,
  type AllowedMediaMimeType,
  type MediaAssetType,
} from "@/lib/media/types";

// ── Storage key ───────────────────────────────────────────────────────────────

export function getMediaAssetKey(
  tenantKey: string,
  assetId: string,
  ext: string,
): string {
  return `media/${tenantKey}/${assetId}.${ext}`;
}

// ── Result types ──────────────────────────────────────────────────────────────

export type MediaUploadResult =
  | {
      ok: true;
      publicUrl: string;
      detectedMime: AllowedMediaMimeType;
      assetType: MediaAssetType;
      ext: string;
    }
  | { ok: false; error: string; status: number };

// ── Main upload ───────────────────────────────────────────────────────────────

/**
 * Uploads a media asset to Vercel Blob.
 *
 * Validation:
 *   1. Declared MIME must be in ALLOWED_MEDIA_MIME_TYPES.
 *   2. Magic-byte inspection via `file-type` must agree with declared MIME.
 *
 * @param tenantKey    Tenant's unique key (e.g. "fc-allschwil").
 * @param assetId      Pre-generated cuid for the MediaAsset record.
 * @param buffer       Raw file bytes.
 * @param declaredMime Browser-supplied Content-Type. Pre-validated by caller.
 */
export async function uploadMediaAsset(
  tenantKey: string,
  assetId: string,
  buffer: Uint8Array,
  declaredMime: string,
): Promise<MediaUploadResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 503,
      error:
        "Media-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert). " +
        "Bitte BLOB_READ_WRITE_TOKEN im Vercel-Projekt konfigurieren.",
    };
  }

  if (!isAllowedMediaMime(declaredMime)) {
    return { ok: false, status: 400, error: `Nicht erlaubter MIME-Typ: ${declaredMime}.` };
  }

  const allowedMime = declaredMime as AllowedMediaMimeType;
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      ok: false,
      status: 400,
      error: "Dateityp konnte nicht erkannt werden.",
    };
  }

  if (!isAllowedMediaMime(detected.mime)) {
    return {
      ok: false,
      status: 400,
      error: `Erkannter Dateityp (${detected.mime}) ist nicht erlaubt.`,
    };
  }

  if (detected.mime !== allowedMime) {
    return {
      ok: false,
      status: 400,
      error: `Deklarierter Typ (${allowedMime}) stimmt nicht mit erkanntem Typ (${detected.mime}) überein.`,
    };
  }

  const ext = mimeToExt(allowedMime)!;
  const storageKey = getMediaAssetKey(tenantKey, assetId, ext);

  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: allowedMime,
    token,
    allowOverwrite: true,
  });

  return {
    ok: true,
    publicUrl: blob.url,
    detectedMime: allowedMime,
    assetType: mimeToAssetType(allowedMime),
    ext,
  };
}

// ── Orphan cleanup ────────────────────────────────────────────────────────────

const VERCEL_BLOB_RE = /\.public\.blob\.vercel-storage\.com$/;

export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return VERCEL_BLOB_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Best-effort deletion of a previously uploaded media blob.
 * Non-fatal — logs but does not throw.
 */
export async function deleteMediaBlob(url: string): Promise<void> {
  if (!isVercelBlobUrl(url)) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await del(url, { token });
  } catch (err) {
    console.warn("[media] deleteMediaBlob: failed to delete", url, err);
  }
}
