/**
 * Reusable tenant-scoped media upload adapter.
 *
 * Uses the same Vercel Blob backend as logo uploads.
 * Tenant isolation: every asset key is prefixed with `media/{tenantKey}/`.
 * Magic-byte validation via `file-type` (same pattern as logo uploads).
 *
 * Returns { ok: true, publicUrl, storageKey } on success so the caller can
 * persist both the CDN URL and the internal key for future cleanup.
 */

import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import {
  isAllowedMediaMimeType,
  mimeToMediaExtension,
  MAX_MEDIA_FILE_SIZE_BYTES,
} from "@/lib/media/validation";
import { safeStem } from "@/lib/assets/validation";

export type UploadMediaResult =
  | { ok: true; publicUrl: string; storageKey: string }
  | { ok: false; error: string; status: number };

/**
 * Builds the Vercel Blob storage key for a tenant media asset.
 * Format: `media/{tenantKey}/{sanitizedStem}-{timestamp}.{ext}`
 */
function buildMediaKey(tenantKey: string, stem: string, ext: string): string {
  const ts = Date.now();
  const safeName = safeStem(stem);
  return `media/${tenantKey}/${safeName}-${ts}.${ext}`;
}

/**
 * Validates and uploads a media file to Vercel Blob.
 *
 * @param tenantKey   Tenant URL-safe key (e.g. "fc-allschwil").
 * @param buffer      Raw file bytes.
 * @param declaredMime Browser-supplied Content-Type (pre-validated by caller).
 * @param originalName Original filename for storage key generation.
 */
export async function uploadMediaAsset(
  tenantKey: string,
  buffer: Uint8Array,
  declaredMime: string,
  originalName: string,
): Promise<UploadMediaResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 503,
      error:
        "Medien-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert). " +
        "Bitte BLOB_READ_WRITE_TOKEN im Vercel-Projekt konfigurieren.",
    };
  }

  if (buffer.byteLength > MAX_MEDIA_FILE_SIZE_BYTES) {
    return { ok: false, status: 400, error: "Datei überschreitet das Limit von 8 MB." };
  }

  if (!isAllowedMediaMimeType(declaredMime)) {
    return { ok: false, status: 400, error: `Nicht erlaubter MIME-Typ: ${declaredMime}.` };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return {
      ok: false,
      status: 400,
      error: "Dateityp konnte nicht erkannt werden. Nur JPEG, PNG, WebP und GIF sind erlaubt.",
    };
  }
  if (!isAllowedMediaMimeType(detected.mime)) {
    return {
      ok: false,
      status: 400,
      error: `Erkannter Dateityp (${detected.mime}) ist nicht erlaubt.`,
    };
  }
  if (detected.mime !== declaredMime) {
    return {
      ok: false,
      status: 400,
      error: `Deklarierter Typ (${declaredMime}) stimmt nicht mit dem erkannten Typ (${detected.mime}) überein.`,
    };
  }

  const ext = mimeToMediaExtension(declaredMime);
  if (!ext) {
    return { ok: false, status: 400, error: "Keine Dateiendung für MIME-Typ ermittelt." };
  }

  const stem = originalName.replace(/\.[^.]+$/, "");
  const storageKey = buildMediaKey(tenantKey, stem, ext);

  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: declaredMime,
    token,
  });

  return { ok: true, publicUrl: blob.url, storageKey };
}
