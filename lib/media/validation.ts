/**
 * Media asset upload validation — reusable across all modules.
 *
 * Supports images only for MVP. Video/embed references are inline in Markdown.
 * SVG is excluded (same policy as logo uploads — requires sanitization).
 */

export const ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

/** Max image upload size: 8 MB */
export const MAX_MEDIA_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const MIME_TO_EXT: Record<AllowedMediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedMediaMimeType(mime: string): mime is AllowedMediaMimeType {
  return (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(mime);
}

export function mimeToMediaExtension(mime: string): string | null {
  if (!isAllowedMediaMimeType(mime)) return null;
  return MIME_TO_EXT[mime];
}

export type MediaUploadValidationResult =
  | { ok: true; mimeType: AllowedMediaMimeType; ext: string }
  | { ok: false; error: string };

/**
 * Client-side first-pass validation for a media file.
 * Server MUST additionally perform magic-byte inspection.
 */
export function validateMediaUploadFile(file: File): MediaUploadValidationResult {
  if (!isAllowedMediaMimeType(file.type)) {
    const allowed = ALLOWED_MEDIA_MIME_TYPES.join(", ");
    return {
      ok: false,
      error: `Ungültiger Dateityp "${file.type || "(unbekannt)"}". Erlaubt: ${allowed}.`,
    };
  }

  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `Datei zu gross (${mb} MB). Maximum: 8 MB.`,
    };
  }

  return {
    ok: true,
    mimeType: file.type as AllowedMediaMimeType,
    ext: MIME_TO_EXT[file.type as AllowedMediaMimeType],
  };
}
