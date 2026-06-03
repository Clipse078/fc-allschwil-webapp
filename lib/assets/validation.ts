/**
 * Canonical Asset Validation — Slice 10.10
 *
 * Single source of truth for upload constraints and URL validation.
 * No duplication across API routes, components, or future storage adapters.
 *
 * ─── Principles ──────────────────────────────────────────────────────────────
 *
 * - Pure functions — no DOM, no React, no Prisma, no fs.
 * - Safe to import from server routes or client components.
 * - All logo-specific constraints live here, not scattered across call sites.
 *
 * ─── SVG policy ──────────────────────────────────────────────────────────────
 *
 * SVG is intentionally excluded from ALLOWED_LOGO_UPLOAD_MIME_TYPES.
 * Reason: SVG files can embed arbitrary JavaScript and remote resource
 * references. Safe SVG upload requires server-side sanitization (e.g. DOMPurify
 * on the parsed XML) before storage and serving — not yet implemented.
 * SVG logos may still be referenced via the manual logoUrl text field as
 * external URLs from a trusted CDN that already sanitizes on ingest.
 *
 * ─── Magic-byte validation (required before upload goes live) ────────────────
 *
 * Browser-supplied Content-Type / File.type is NOT trustworthy on its own.
 * A future upload route MUST add server-side magic-byte inspection
 * (e.g. the `file-type` npm package) before writing any file to storage.
 * The MIME type check in validateLogoUploadFile() is a first-pass filter only
 * and must be paired with magic-byte verification at the storage adapter layer.
 */

// ── Allowed upload MIME types ─────────────────────────────────────────────────

/**
 * MIME types accepted for logo upload.
 * SVG is explicitly excluded — see SVG policy above.
 * Used by: future upload route, file input `accept` attribute.
 */
export const ALLOWED_LOGO_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedLogoUploadMimeType = (typeof ALLOWED_LOGO_UPLOAD_MIME_TYPES)[number];

// ── File size ─────────────────────────────────────────────────────────────────

/** Maximum logo file size: 2 MB */
export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// ── MIME → extension map ──────────────────────────────────────────────────────

const MIME_TO_EXT: Record<AllowedLogoUploadMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// ── Guards ────────────────────────────────────────────────────────────────────

export function isAllowedLogoUploadMimeType(mime: string): mime is AllowedLogoUploadMimeType {
  return (ALLOWED_LOGO_UPLOAD_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Returns the canonical lowercase file extension for an allowed upload MIME type.
 * Returns null for disallowed types.
 *
 * NOTE: Call isAllowedLogoUploadMimeType() first; do not use the extension
 * from this function as the sole security gate.
 */
export function mimeToLogoExtension(mime: string): string | null {
  if (!isAllowedLogoUploadMimeType(mime)) return null;
  return MIME_TO_EXT[mime];
}

// ── Safe filename ─────────────────────────────────────────────────────────────

/**
 * Produces a safe, filesystem-friendly filename stem from an arbitrary string.
 * Strips path separators, collapses whitespace/specials to hyphens,
 * lowercases, and trims edge hyphens. Fallback: "file".
 *
 * Used by future storage adapters — not needed for tenant-keyed paths
 * (which use the tenant key directly) but provided for general asset naming.
 */
export function safeStem(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

// ── Upload file validation ────────────────────────────────────────────────────

export type LogoUploadValidationResult =
  | { ok: true; mimeType: AllowedLogoUploadMimeType; ext: string }
  | { ok: false; error: string };

/**
 * First-pass validation for a logo file selected by the user.
 *
 * Checks:
 *   1. MIME type against ALLOWED_LOGO_UPLOAD_MIME_TYPES (browser-supplied)
 *   2. File size against MAX_LOGO_FILE_SIZE_BYTES
 *
 * IMPORTANT: This check is necessary but NOT sufficient for server-side use.
 * The upload route MUST additionally perform magic-byte inspection before
 * writing to storage. See module-level comment above.
 */
export function validateLogoUploadFile(file: File): LogoUploadValidationResult {
  if (!isAllowedLogoUploadMimeType(file.type)) {
    const allowed = ALLOWED_LOGO_UPLOAD_MIME_TYPES.join(", ");
    return {
      ok: false,
      error: `Ungültiger Dateityp "${file.type || "(unbekannt)"}". Erlaubt: ${allowed}.`,
    };
  }

  if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `Datei zu gross (${mb} MB). Maximum: 2 MB.`,
    };
  }

  return {
    ok: true,
    mimeType: file.type as AllowedLogoUploadMimeType,
    ext: MIME_TO_EXT[file.type as AllowedLogoUploadMimeType],
  };
}
