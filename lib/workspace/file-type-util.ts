/**
 * Workspace file type utilities.
 *
 * Provides a normalized file category, German-friendly label, icon category,
 * and preview capability for any MIME type or filename extension.
 *
 * Never exposes raw MIME strings to the UI.
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
  /** Normalized category for icon selection and preview routing. */
  category: WorkspaceFileCategory;
  /** Human-readable German label for display in the UI. */
  germanLabel: string;
  /** Whether an inline browser preview can be shown for this type. */
  previewCapable: boolean;
};

const MIME_MAP: Record<string, WorkspaceFileTypeInfo> = {
  "application/pdf": {
    category: "pdf",
    germanLabel: "PDF-Dokument",
    previewCapable: true,
  },

  "application/msword": {
    category: "word",
    germanLabel: "Word-Dokument",
    previewCapable: false,
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    category: "word",
    germanLabel: "Word-Dokument",
    previewCapable: false,
  },

  "application/vnd.ms-excel": {
    category: "excel",
    germanLabel: "Excel-Arbeitsmappe",
    previewCapable: false,
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    category: "excel",
    germanLabel: "Excel-Arbeitsmappe",
    previewCapable: false,
  },

  "application/vnd.ms-powerpoint": {
    category: "powerpoint",
    germanLabel: "PowerPoint-Präsentation",
    previewCapable: false,
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    category: "powerpoint",
    germanLabel: "PowerPoint-Präsentation",
    previewCapable: false,
  },

  "image/jpeg": {
    category: "image",
    germanLabel: "JPEG-Bild",
    previewCapable: true,
  },
  "image/png": {
    category: "image",
    germanLabel: "PNG-Bild",
    previewCapable: true,
  },
  "image/webp": {
    category: "image",
    germanLabel: "WebP-Bild",
    previewCapable: true,
  },
  "image/gif": {
    category: "image",
    germanLabel: "GIF-Bild",
    previewCapable: true,
  },
  "image/svg+xml": {
    category: "image",
    germanLabel: "SVG-Bild",
    previewCapable: true,
  },

  "video/mp4": {
    category: "video",
    germanLabel: "Video",
    previewCapable: false,
  },
  "video/webm": {
    category: "video",
    germanLabel: "Video",
    previewCapable: false,
  },
  "video/ogg": {
    category: "video",
    germanLabel: "Video",
    previewCapable: false,
  },

  "audio/mpeg": {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },
  "audio/mp4": {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },
  "audio/wav": {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },
  "audio/ogg": {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },

  "application/zip": {
    category: "archive",
    germanLabel: "ZIP-Archiv",
    previewCapable: false,
  },
  "application/x-zip-compressed": {
    category: "archive",
    germanLabel: "ZIP-Archiv",
    previewCapable: false,
  },
  "application/x-tar": {
    category: "archive",
    germanLabel: "Archiv",
    previewCapable: false,
  },

  "text/plain": {
    category: "text",
    germanLabel: "Textdokument",
    previewCapable: false,
  },
  "text/csv": {
    category: "text",
    germanLabel: "CSV-Datei",
    previewCapable: false,
  },
  "text/html": {
    category: "text",
    germanLabel: "HTML-Dokument",
    previewCapable: false,
  },
};

const EXTENSION_MAP: Record<string, WorkspaceFileTypeInfo> = {
  pdf: {
    category: "pdf",
    germanLabel: "PDF-Dokument",
    previewCapable: true,
  },
  doc: {
    category: "word",
    germanLabel: "Word-Dokument",
    previewCapable: false,
  },
  docx: {
    category: "word",
    germanLabel: "Word-Dokument",
    previewCapable: false,
  },
  xls: {
    category: "excel",
    germanLabel: "Excel-Arbeitsmappe",
    previewCapable: false,
  },
  xlsx: {
    category: "excel",
    germanLabel: "Excel-Arbeitsmappe",
    previewCapable: false,
  },
  ppt: {
    category: "powerpoint",
    germanLabel: "PowerPoint-Präsentation",
    previewCapable: false,
  },
  pptx: {
    category: "powerpoint",
    germanLabel: "PowerPoint-Präsentation",
    previewCapable: false,
  },
  jpg: {
    category: "image",
    germanLabel: "JPEG-Bild",
    previewCapable: true,
  },
  jpeg: {
    category: "image",
    germanLabel: "JPEG-Bild",
    previewCapable: true,
  },
  png: {
    category: "image",
    germanLabel: "PNG-Bild",
    previewCapable: true,
  },
  webp: {
    category: "image",
    germanLabel: "WebP-Bild",
    previewCapable: true,
  },
  gif: {
    category: "image",
    germanLabel: "GIF-Bild",
    previewCapable: true,
  },
  svg: {
    category: "image",
    germanLabel: "SVG-Bild",
    previewCapable: true,
  },
  mp4: {
    category: "video",
    germanLabel: "Video",
    previewCapable: false,
  },
  webm: {
    category: "video",
    germanLabel: "Video",
    previewCapable: false,
  },
  mp3: {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },
  wav: {
    category: "audio",
    germanLabel: "Audiodatei",
    previewCapable: false,
  },
  zip: {
    category: "archive",
    germanLabel: "ZIP-Archiv",
    previewCapable: false,
  },
  tar: {
    category: "archive",
    germanLabel: "Archiv",
    previewCapable: false,
  },
  txt: {
    category: "text",
    germanLabel: "Textdokument",
    previewCapable: false,
  },
  csv: {
    category: "text",
    germanLabel: "CSV-Datei",
    previewCapable: false,
  },
};

const UNKNOWN: WorkspaceFileTypeInfo = {
  category: "unknown",
  germanLabel: "Datei",
  previewCapable: false,
};

/**
 * Resolves file type information from a MIME type.
 * Falls back to an extension extracted from `filename` when the MIME type
 * is not recognised.
 *
 * Never returns raw MIME strings or internal categories.
 */
export function resolveWorkspaceFileType(
  mimeType: string,
  filename?: string,
): WorkspaceFileTypeInfo {
  const normMime = mimeType.trim().toLowerCase();

  // Exact MIME match
  const mimeResult = MIME_MAP[normMime];

  if (mimeResult) {
    return mimeResult;
  }

  // Wildcard MIME prefix matching (image/*, video/*, audio/*)
  if (normMime.startsWith("image/")) {
    return { category: "image", germanLabel: "Bild", previewCapable: true };
  }

  if (normMime.startsWith("video/")) {
    return { category: "video", germanLabel: "Video", previewCapable: false };
  }

  if (normMime.startsWith("audio/")) {
    return { category: "audio", germanLabel: "Audiodatei", previewCapable: false };
  }

  if (normMime.startsWith("text/")) {
    return { category: "text", germanLabel: "Textdokument", previewCapable: false };
  }

  // Extension fallback
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();

    if (ext) {
      const extResult = EXTENSION_MAP[ext];

      if (extResult) {
        return extResult;
      }
    }
  }

  return UNKNOWN;
}

/**
 * Returns the German-friendly label for a MIME type, without exposing the
 * raw MIME string.
 */
export function getWorkspaceFileGermanLabel(
  mimeType: string,
  filename?: string,
): string {
  return resolveWorkspaceFileType(mimeType, filename).germanLabel;
}
