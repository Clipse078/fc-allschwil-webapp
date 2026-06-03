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
 * Every upload key is prefixed with `logos/{tenantKey}.{ext}`.
 * One key per tenant per extension — overwrites the same key each time,
 * guaranteeing zero orphaned duplicates by construction.
 *
 * ─── Env var ─────────────────────────────────────────────────────────────────
 *
 * BLOB_READ_WRITE_TOKEN  — required at runtime; injected via Vercel project
 *                          settings or a local .env.local file.
 *                          The SDK reads it automatically from process.env.
 */

import { put } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import {
  isAllowedLogoUploadMimeType,
  mimeToLogoExtension,
  type AllowedLogoUploadMimeType,
} from "@/lib/assets/validation";
import { getTenantLogoKey } from "@/lib/assets/tenant-paths";

// ── Environment guard ─────────────────────────────────────────────────────────

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN environment variable is not set. " +
        "Add it to your .env.local (development) or Vercel project settings (production).",
    );
  }
  return token;
}

// ── Result types ──────────────────────────────────────────────────────────────

export type UploadLogoResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

// ── Main adapter function ─────────────────────────────────────────────────────

/**
 * Validates and uploads a tenant logo to Vercel Blob.
 *
 * Validation performed here (server-side, not client-side):
 *   1. Declared MIME must be in ALLOWED_LOGO_UPLOAD_MIME_TYPES.
 *   2. Magic-byte inspection via `file-type` must agree with declared MIME.
 *   3. (File size pre-checked by caller via validateLogoUploadFile().)
 *
 * On success returns the Vercel Blob public CDN URL.
 * The caller must persist this URL to Tenant.logoUrl.
 *
 * @param tenantKey   Tenant's unique key (e.g. "fc-allschwil").
 * @param buffer      Raw file bytes.
 * @param declaredMime Browser-supplied Content-Type. Pre-validated by caller.
 */
export async function uploadTenantLogo(
  tenantKey: string,
  buffer: Uint8Array,
  declaredMime: string,
): Promise<UploadLogoResult> {
  // ── Guard 1: declared MIME must be allowed ────────────────────────────────
  if (!isAllowedLogoUploadMimeType(declaredMime)) {
    return { ok: false, error: `Nicht erlaubter MIME-Typ: ${declaredMime}.` };
  }

  const allowedMime = declaredMime as AllowedLogoUploadMimeType;

  // ── Guard 2: magic-byte verification ─────────────────────────────────────
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      ok: false,
      error:
        "Dateityp konnte nicht erkannt werden. Nur PNG, JPEG und WebP sind erlaubt.",
    };
  }

  if (!isAllowedLogoUploadMimeType(detected.mime)) {
    return {
      ok: false,
      error: `Erkannter Dateityp (${detected.mime}) ist nicht erlaubt. Nur PNG, JPEG und WebP sind erlaubt.`,
    };
  }

  if (detected.mime !== allowedMime) {
    return {
      ok: false,
      error: `Deklarierter Typ (${allowedMime}) stimmt nicht mit dem erkannten Typ (${detected.mime}) überein.`,
    };
  }

  // ── Build storage key ─────────────────────────────────────────────────────
  const ext = mimeToLogoExtension(allowedMime);
  if (!ext) {
    return { ok: false, error: "Keine Dateiendung für MIME-Typ ermittelt." };
  }

  const storageKey = getTenantLogoKey(tenantKey, ext);

  // ── Upload to Vercel Blob ─────────────────────────────────────────────────
  const token = requireBlobToken();

  // @vercel/blob's put() accepts Buffer but not Uint8Array directly.
  const blob = await put(storageKey, Buffer.from(buffer), {
    access: "public",
    contentType: allowedMime,
    token,
    // allowOverwrite ensures a re-upload for the same tenant replaces the
    // existing blob at the same key — guaranteeing no orphan accumulation.
    allowOverwrite: true,
  });

  return { ok: true, publicUrl: blob.url };
}
