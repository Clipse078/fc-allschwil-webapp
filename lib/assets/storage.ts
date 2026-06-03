/**
 * Persistent Logo Storage Adapter — Slice 10.11
 *
 * Single upload entry-point for tenant logos.
 * Delegates to Vercel Blob for object storage.
 *
 * ─── Why Vercel Blob ─────────────────────────────────────────────────────────
 *
 * Vercel Blob is the zero-config persistent object store for Vercel-hosted
 * applications. It eliminates runtime local-filesystem writes (which are not
 * durable on ephemeral serverless deployments) and provides CDN-served public
 * URLs out of the box.
 *
 * ─── No duplicate logic ──────────────────────────────────────────────────────
 *
 * - Key construction:  getTenantLogoKey() from tenant-paths.ts
 * - MIME → extension:  mimeToLogoExtension() from validation.ts
 * - Magic-byte check:  fileTypeFromBuffer() (file-type package)
 * - First-pass MIME:   validateLogoUploadFile() (server caller responsibility)
 *
 * ─── Tenant isolation ────────────────────────────────────────────────────────
 *
 * Every upload key is `logos/{tenantKey}.{ext}` (via getTenantLogoKey).
 * Re-uploading the same extension overwrites the same key — no duplicate for
 * that format. When the format changes (e.g. PNG→WebP), the caller MUST invoke
 * deleteOrphanedLogo() on the old URL after a successful upload to prevent
 * cross-extension orphans.
 *
 * ─── Missing token ───────────────────────────────────────────────────────────
 *
 * If BLOB_READ_WRITE_TOKEN is absent at runtime, uploadTenantLogo() returns
 * { ok: false, status: 503 } so the API route can surface a clean JSON error
 * rather than crashing with an unhandled exception.
 *
 * ─── Env var ─────────────────────────────────────────────────────────────────
 *
 * BLOB_READ_WRITE_TOKEN  — required at runtime; injected via Vercel project
 *                          settings or a local .env.local file.
 *                          The SDK reads it automatically from process.env.
 */

import { put, del } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import {
  isAllowedLogoUploadMimeType,
  mimeToLogoExtension,
  type AllowedLogoUploadMimeType,
} from "@/lib/assets/validation";
import { getTenantLogoKey } from "@/lib/assets/tenant-paths";

// ── Vercel Blob URL detection ─────────────────────────────────────────────────

const VERCEL_BLOB_HOSTNAME_RE = /\.public\.blob\.vercel-storage\.com$/;

/**
 * Returns true when `url` is a Vercel Blob CDN URL.
 * Used to decide whether a previous logoUrl should be deleted after re-upload.
 */
export function isVercelBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return VERCEL_BLOB_HOSTNAME_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// ── Result types ──────────────────────────────────────────────────────────────

export type UploadLogoResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string; status: number };

// ── Main upload function ──────────────────────────────────────────────────────

/**
 * Validates and uploads a tenant logo to Vercel Blob.
 *
 * Validation performed here (server-side, not client-side):
 *   1. Declared MIME must be in ALLOWED_LOGO_UPLOAD_MIME_TYPES.
 *   2. Magic-byte inspection via `file-type` must agree with declared MIME.
 *   3. (File size pre-checked by caller via validateLogoUploadFile().)
 *
 * Returns { ok: false, status: 503 } when BLOB_READ_WRITE_TOKEN is absent —
 * no throw, so the caller can propagate a clean JSON error.
 *
 * On success returns the Vercel Blob public CDN URL.
 * The caller must persist this URL to Tenant.logoUrl and call
 * deleteOrphanedLogo() on the previous URL if it was a different blob key.
 *
 * @param tenantKey    Tenant's unique key (e.g. "fc-allschwil").
 * @param buffer       Raw file bytes.
 * @param declaredMime Browser-supplied Content-Type. Pre-validated by caller.
 */
export async function uploadTenantLogo(
  tenantKey: string,
  buffer: Uint8Array,
  declaredMime: string,
): Promise<UploadLogoResult> {
  // ── Token check (no throw — caller surfaces as 503) ───────────────────────
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 503,
      error:
        "Logo-Upload ist derzeit nicht verfügbar (Speicher nicht konfiguriert). " +
        "Bitte BLOB_READ_WRITE_TOKEN im Vercel-Projekt konfigurieren.",
    };
  }

  // ── Guard 1: declared MIME must be allowed ────────────────────────────────
  if (!isAllowedLogoUploadMimeType(declaredMime)) {
    return { ok: false, status: 400, error: `Nicht erlaubter MIME-Typ: ${declaredMime}.` };
  }

  const allowedMime = declaredMime as AllowedLogoUploadMimeType;

  // ── Guard 2: magic-byte verification ─────────────────────────────────────
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      ok: false,
      status: 400,
      error: "Dateityp konnte nicht erkannt werden. Nur PNG, JPEG und WebP sind erlaubt.",
    };
  }

  if (!isAllowedLogoUploadMimeType(detected.mime)) {
    return {
      ok: false,
      status: 400,
      error: `Erkannter Dateityp (${detected.mime}) ist nicht erlaubt. Nur PNG, JPEG und WebP sind erlaubt.`,
    };
  }

  if (detected.mime !== allowedMime) {
    return {
      ok: false,
      status: 400,
      error: `Deklarierter Typ (${allowedMime}) stimmt nicht mit dem erkannten Typ (${detected.mime}) überein.`,
    };
  }

  // ── Build storage key ─────────────────────────────────────────────────────
  const ext = mimeToLogoExtension(allowedMime);
  if (!ext) {
    return { ok: false, status: 400, error: "Keine Dateiendung für MIME-Typ ermittelt." };
  }

  const storageKey = getTenantLogoKey(tenantKey, ext);

  // ── Upload to Vercel Blob ─────────────────────────────────────────────────
  // @vercel/blob's put() accepts Buffer but not Uint8Array directly.
  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: allowedMime,
    token,
    // allowOverwrite: true — same tenant + same extension always overwrites the
    // same key, so re-uploads of the same format never accumulate duplicates.
    allowOverwrite: true,
  });

  return { ok: true, publicUrl: blob.url };
}

// ── Orphaned blob cleanup ─────────────────────────────────────────────────────

/**
 * Best-effort deletion of a previous logo blob.
 *
 * Call this AFTER a successful upload + DB update when the old logoUrl was a
 * Vercel Blob URL that differs from the newly uploaded URL (i.e. the extension
 * changed: PNG→WebP, etc.). If deletion fails the upload is already persisted;
 * log the error but do not surface it to the caller.
 *
 * No-ops silently when:
 *   - oldUrl is null/empty
 *   - oldUrl is not a Vercel Blob URL (external CDN, root-relative path, etc.)
 *   - oldUrl equals newUrl (same key re-uploaded)
 *   - BLOB_READ_WRITE_TOKEN is absent
 */
export async function deleteOrphanedLogo(
  oldUrl: string | null | undefined,
  newUrl: string,
): Promise<void> {
  if (!oldUrl || !isVercelBlobUrl(oldUrl) || oldUrl === newUrl) return;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  try {
    await del(oldUrl, { token });
  } catch (err) {
    // Non-fatal: orphan cleanup is best-effort.
    // The new blob is already uploaded and the DB already updated.
    console.warn("[storage] deleteOrphanedLogo: failed to delete old blob", oldUrl, err);
  }
}
