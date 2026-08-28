/**
 * TEAM-COCKPIT-PREMIUM-01J-B — display formatters for team document metadata.
 * Provider-neutral helpers for file type, size, and date presentation.
 */

const MIME_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "text/csv": "CSV",
  "text/plain": "TXT",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "audio/mpeg": "MP3",
};

const EXTENSION_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  ppt: "PPT",
  pptx: "PPTX",
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  webp: "WEBP",
  gif: "GIF",
  svg: "SVG",
  csv: "CSV",
  txt: "TXT",
  zip: "ZIP",
  mp4: "MP4",
  webm: "WEBM",
  mp3: "MP3",
};

function extensionFromFilename(filename: string): string | null {
  const trimmed = filename.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(dotIndex + 1).toLowerCase();
}

/**
 * Returns a short, human-readable file type label (e.g. PDF, DOCX).
 */
export function formatTeamDocumentFileType(
  mimeType: string,
  filename?: string,
): string {
  if (filename) {
    const extension = extensionFromFilename(filename);
    if (extension) {
      const known = EXTENSION_LABELS[extension];
      if (known) return known;
      if (extension.length <= 5) {
        return extension.toUpperCase();
      }
    }
  }

  const normalizedMime = mimeType.trim().toLowerCase();
  const mimeLabel = MIME_TYPE_LABELS[normalizedMime];
  if (mimeLabel) return mimeLabel;

  if (normalizedMime.startsWith("image/")) {
    const subtype = normalizedMime.slice("image/".length);
    if (subtype === "jpeg") return "JPG";
    if (subtype.length <= 4) return subtype.toUpperCase();
  }

  if (normalizedMime.startsWith("video/")) {
    const subtype = normalizedMime.slice("video/".length);
    if (subtype.length <= 4) return subtype.toUpperCase();
  }

  if (normalizedMime.startsWith("audio/")) {
    const subtype = normalizedMime.slice("audio/".length);
    if (subtype.length <= 4) return subtype.toUpperCase();
  }

  return "DATEI";
}

/**
 * Readable file size for document metadata rows.
 */
export function formatTeamDocumentFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Concise de-CH date for list rows (e.g. 28.08.2026).
 */
export function formatTeamDocumentDate(value: Date | string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
