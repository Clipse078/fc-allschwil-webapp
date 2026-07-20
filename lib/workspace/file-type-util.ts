/**
 * Workspace file type utilities.
 *
 * Provides a normalized file category and preview capability for any MIME type
 * or filename extension. German labels and human-readable strings are NOT
 * included here — they live in `messages/de.json` under `Workspace.fileTypes`
 * and are accessed via next-intl in the rendering layer.
 */

export type WorkspaceFileCategory =
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "text"
  | "unknown";

export type WorkspaceFileTypeInfo = {
  /** Normalized category. Use as the key for `t('Workspace.fileTypes.{category}')`. */
  category: WorkspaceFileCategory;
  /** Whether an inline browser preview can be shown for this type. */
  previewCapable: boolean;
};

type MimeCategoryEntry = { category: WorkspaceFileCategory; previewCapable: boolean };

const MIME_MAP: Record<string, MimeCategoryEntry> = {
  "application/pdf": { category: "pdf", previewCapable: true },

  "application/msword": { category: "word", previewCapable: false },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    category: "word",
    previewCapable: false,
  },

  "application/vnd.ms-excel": { category: "excel", previewCapable: false },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    category: "excel",
    previewCapable: false,
  },

  "application/vnd.ms-powerpoint": { category: "powerpoint", previewCapable: false },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    category: "powerpoint",
    previewCapable: false,
  },

  "image/jpeg": { category: "image", previewCapable: true },
  "image/png": { category: "image", previewCapable: true },
  "image/webp": { category: "image", previewCapable: true },
  "image/gif": { category: "image", previewCapable: true },
  "image/svg+xml": { category: "image", previewCapable: true },

  "video/mp4": { category: "video", previewCapable: false },
  "video/webm": { category: "video", previewCapable: false },
  "video/ogg": { category: "video", previewCapable: false },

  "audio/mpeg": { category: "audio", previewCapable: false },
  "audio/mp4": { category: "audio", previewCapable: false },
  "audio/wav": { category: "audio", previewCapable: false },
  "audio/ogg": { category: "audio", previewCapable: false },

  "application/zip": { category: "archive", previewCapable: false },
  "application/x-zip-compressed": { category: "archive", previewCapable: false },
  "application/x-tar": { category: "archive", previewCapable: false },

  "text/plain": { category: "text", previewCapable: false },
  "text/csv": { category: "text", previewCapable: false },
  "text/html": { category: "text", previewCapable: false },
};

const EXTENSION_MAP: Record<string, MimeCategoryEntry> = {
  pdf: { category: "pdf", previewCapable: true },
  doc: { category: "word", previewCapable: false },
  docx: { category: "word", previewCapable: false },
  xls: { category: "excel", previewCapable: false },
  xlsx: { category: "excel", previewCapable: false },
  ppt: { category: "powerpoint", previewCapable: false },
  pptx: { category: "powerpoint", previewCapable: false },
  jpg: { category: "image", previewCapable: true },
  jpeg: { category: "image", previewCapable: true },
  png: { category: "image", previewCapable: true },
  webp: { category: "image", previewCapable: true },
  gif: { category: "image", previewCapable: true },
  svg: { category: "image", previewCapable: true },
  mp4: { category: "video", previewCapable: false },
  webm: { category: "video", previewCapable: false },
  mp3: { category: "audio", previewCapable: false },
  wav: { category: "audio", previewCapable: false },
  zip: { category: "archive", previewCapable: false },
  tar: { category: "archive", previewCapable: false },
  txt: { category: "text", previewCapable: false },
  csv: { category: "text", previewCapable: false },
};

const UNKNOWN: WorkspaceFileTypeInfo = {
  category: "unknown",
  previewCapable: false,
};

/**
 * Resolves file type information from a MIME type.
 * Falls back to an extension extracted from `filename` when the MIME type
 * is not recognised.
 *
 * Returns only a category and preview flag. Labels are in messages/de.json.
 */
export function resolveWorkspaceFileType(
  mimeType: string,
  filename?: string,
): WorkspaceFileTypeInfo {
  const normMime = mimeType.trim().toLowerCase();

  const mimeResult = MIME_MAP[normMime];
  if (mimeResult) return mimeResult;

  if (normMime.startsWith("image/")) return { category: "image", previewCapable: true };
  if (normMime.startsWith("video/")) return { category: "video", previewCapable: false };
  if (normMime.startsWith("audio/")) return { category: "audio", previewCapable: false };
  if (normMime.startsWith("text/")) return { category: "text", previewCapable: false };

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) {
      const extResult = EXTENSION_MAP[ext];
      if (extResult) return extResult;
    }
  }

  return UNKNOWN;
}
