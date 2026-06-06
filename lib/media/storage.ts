/**
 * Media Asset Storage Adapter
 *
 * Provider-agnostic upload interface for the Media Library.
 * Current implementation: Vercel Blob (StorageProvider.BLOB).
 *
 * The storageProvider / storageKey / storagePath triad on MediaAsset ensures
 * future migration to S3 or R2 requires only a new case in this module —
 * no schema changes, no consumer changes.
 *
 * Naming convention:
 *   storageKey   — provider-internal path: "media/{tenantKey}/{uuid}.{ext}"
 *   storagePath  — public CDN URL returned by the provider
 */

import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import { isAllowedMediaMimeType, mimeToExtension } from "./validation";
import type { StorageProvider } from "@prisma/client";

// ── Key construction ──────────────────────────────────────────────────────────

/**
 * Builds the provider storage key for a media asset.
 * Example: "media/fc-allschwil/cuid123.jpg"
 */
export function buildMediaStorageKey(tenantKey: string, uuid: string, ext: string): string {
  return `media/${tenantKey}/${uuid}.${ext}`;
}

// ── Result types ──────────────────────────────────────────────────────────────

export type UploadMediaResult =
  | { ok: true; publicUrl: string; storageKey: string; provider: StorageProvider }
  | { ok: false; error: string; status: number };

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Uploads a media asset to Vercel Blob.
 *
 * Validation performed here:
 *   1. BLOB_READ_WRITE_TOKEN presence check.
 *   2. Declared MIME must be in ALLOWED_MEDIA_MIME_TYPES.
 *   3. Magic-byte inspection via file-type.
 *
 * Returns { ok: false, status: 503 } when the token is absent.
 */
export async function uploadMediaAsset(
  tenantKey: string,
  assetId: string,
  buffer: Uint8Array,
  declaredMime: string,
): Promise<UploadMediaResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 503,
      error:
        "Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert). " +
        "Bitte BLOB_READ_WRITE_TOKEN im Vercel-Projekt konfigurieren.",
    };
  }

  if (!isAllowedMediaMimeType(declaredMime)) {
    return { ok: false, status: 400, error: `Nicht erlaubter MIME-Typ: ${declaredMime}.` };
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      ok: false,
      status: 400,
      error: "Dateityp konnte nicht erkannt werden.",
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

  const ext = mimeToExtension(declaredMime);
  if (!ext) {
    return { ok: false, status: 400, error: "Keine Dateiendung für MIME-Typ ermittelt." };
  }

  const storageKey = buildMediaStorageKey(tenantKey, assetId, ext);

  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: declaredMime,
    token,
    allowOverwrite: true,
  });

  return {
    ok: true,
    publicUrl: blob.url,
    storageKey,
    provider: "BLOB",
  };
}

/**
 * Best-effort deletion of a media blob.
 * Call after archiving or replacing an asset.
 * Non-fatal: logs but does not throw.
 */
export async function deleteMediaBlob(storagePath: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !storagePath) return;

  try {
    const { del } = await import("@vercel/blob");
    await del(storagePath, { token });
  } catch (err) {
    console.warn("[media/storage] deleteMediaBlob: failed to delete blob", storagePath, err);
  }
}
