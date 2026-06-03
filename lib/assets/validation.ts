/**
 * Canonical Asset Validation — Slice 10.10
 *
 * Single source of truth for all upload/file validation.
 * No duplication across API routes, components, or future storage adapters.
 *
 * ─── Principles ──────────────────────────────────────────────────────────────
 *
 * - Pure functions — no DOM, no React, no Prisma, no fs.
 * - Safe to import from server routes or client components (mime constants only).
 * - All logo-specific constraints live here, not scattered across call sites.
 */

// ── Allowed MIME types ────────────────────────────────────────────────────────

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
] as const;

export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

// ── File size ─────────────────────────────────────────────────────────────────

/** Maximum logo file size: 2 MB */
export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// ── MIME → extension map ──────────────────────────────────────────────────────

const MIME_TO_EXT: Record<AllowedLogoMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

// ── Guards ────────────────────────────────────────────────────────────────────

export function isAllowedLogoMimeType(mime: string): mime is AllowedLogoMimeType {
  return (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Returns the canonical lowercase file extension for an allowed logo MIME type.
 * Returns null for disallowed types — callers must gate on isAllowedLogoMimeType first.
 */
export function mimeToLogoExtension(mime: string): string | null {
  if (!isAllowedLogoMimeType(mime)) return null;
  return MIME_TO_EXT[mime];
}

// ── Safe filename ─────────────────────────────────────────────────────────────

/**
 * Produces a safe, filesystem-friendly filename stem from an arbitrary string.
 * Strips path separators, collapses whitespace/specials to hyphens,
 * lowercases, and trims edge hyphens. Fallback: "file".
 */
export function safeStem(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

// ── Logo file validation ──────────────────────────────────────────────────────

export type LogoFileValidationResult =
  | { ok: true; mimeType: AllowedLogoMimeType; ext: string }
  | { ok: false; error: string };

/**
 * Validates a File object for logo upload.
 * Checks MIME type against the allow-list and enforces the max file size.
 * Does NOT read file bytes — no magic-byte check (acceptable for this scope).
 */
export function validateLogoFile(file: File): LogoFileValidationResult {
  if (!isAllowedLogoMimeType(file.type)) {
    const allowed = ALLOWED_LOGO_MIME_TYPES.join(", ");
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
    mimeType: file.type as AllowedLogoMimeType,
    ext: MIME_TO_EXT[file.type as AllowedLogoMimeType],
  };
}
