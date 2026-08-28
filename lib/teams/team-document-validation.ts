import { fileTypeFromBuffer } from "file-type";
import {
  MAX_WORKSPACE_FILE_SIZE_BYTES,
  isAllowedWorkspaceMimeType,
  sanitizeWorkspaceFilename,
  type AllowedWorkspaceMimeType,
} from "@/lib/workspace/upload-types";

const ALLOWED_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  zip: ["application/zip", "application/x-zip-compressed"],
} as const;

const LEGACY_OFFICE_DETECTED_MIMES = new Set([
  "application/x-cfb",
  "application/cdfv2",
]);

export type ValidatedTeamDocumentUpload = {
  originalFilename: string;
  sanitizedFilename: string;
  contentType: AllowedWorkspaceMimeType;
  sizeBytes: number;
};

export type TeamDocumentValidationErrorCode =
  | "INVALID_FILENAME"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "TYPE_NOT_ALLOWED"
  | "CONTENT_TYPE_MISMATCH"
  | "UNTRUSTED_TEXT_CONTENT";

export class TeamDocumentValidationError extends Error {
  constructor(
    readonly code: TeamDocumentValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamDocumentValidationError";
  }
}

function filenameExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index > -1 ? filename.slice(index + 1).toLowerCase() : "";
}

function matchesExpectedMime(
  extension: string,
  declaredContentType: string,
): declaredContentType is AllowedWorkspaceMimeType {
  const expected = ALLOWED_TYPES[extension as keyof typeof ALLOWED_TYPES];
  if (!expected) {
    return false;
  }

  if (Array.isArray(expected)) {
    return expected.includes(
      declaredContentType as (typeof expected)[number],
    );
  }

  return declaredContentType === expected;
}

function validatePlainText(buffer: Uint8Array): void {
  if (buffer.includes(0)) {
    throw new TeamDocumentValidationError(
      "UNTRUSTED_TEXT_CONTENT",
      "Textdateien dürfen keine Binärdaten enthalten.",
    );
  }

  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  if (/<(?:!doctype|html|script|svg)\b/i.test(decoded)) {
    throw new TeamDocumentValidationError(
      "UNTRUSTED_TEXT_CONTENT",
      "HTML-, Script- und SVG-Inhalte sind nicht erlaubt.",
    );
  }
}

function isLegacyOfficeExtension(extension: string): boolean {
  return extension === "doc" || extension === "xls" || extension === "ppt";
}

/**
 * Validates extension, declared MIME, workspace allowlist and detected file
 * signature together. Team documents follow the workspace size limit (100 MiB)
 * while using stronger content checks inspired by communication attachments.
 */
export async function validateTeamDocumentUpload(input: {
  filename: string;
  declaredContentType: string;
  buffer: Uint8Array;
}): Promise<ValidatedTeamDocumentUpload> {
  const originalFilename = input.filename.trim();
  const sanitizedFilename = sanitizeWorkspaceFilename(originalFilename);
  if (!originalFilename || !sanitizedFilename.includes(".")) {
    throw new TeamDocumentValidationError(
      "INVALID_FILENAME",
      "Ein Dateiname mit erlaubter Endung ist erforderlich.",
    );
  }
  if (input.buffer.byteLength === 0) {
    throw new TeamDocumentValidationError(
      "EMPTY_FILE",
      "Leere Dateien sind nicht erlaubt.",
    );
  }
  if (input.buffer.byteLength > MAX_WORKSPACE_FILE_SIZE_BYTES) {
    throw new TeamDocumentValidationError(
      "FILE_TOO_LARGE",
      "Die Datei überschreitet die maximale Dateigrösse.",
    );
  }

  const extension = filenameExtension(sanitizedFilename);
  const declaredContentType = input.declaredContentType
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!matchesExpectedMime(extension, declaredContentType)) {
    throw new TeamDocumentValidationError(
      "TYPE_NOT_ALLOWED",
      "Dieser Dateityp ist nicht erlaubt.",
    );
  }

  if (!isAllowedWorkspaceMimeType(declaredContentType)) {
    throw new TeamDocumentValidationError(
      "TYPE_NOT_ALLOWED",
      "Dieser Dateityp ist nicht erlaubt.",
    );
  }

  const expectedType = ALLOWED_TYPES[extension as keyof typeof ALLOWED_TYPES];
  const primaryExpectedType = Array.isArray(expectedType)
    ? expectedType[0]
    : expectedType;

  const detected = await fileTypeFromBuffer(input.buffer);
  if (extension === "txt" || extension === "csv") {
    if (detected) {
      throw new TeamDocumentValidationError(
        "CONTENT_TYPE_MISMATCH",
        "Die Textdatei enthält einen anderen erkannten Dateityp.",
      );
    }
    validatePlainText(input.buffer);
  } else if (isLegacyOfficeExtension(extension)) {
    if (
      detected &&
      !LEGACY_OFFICE_DETECTED_MIMES.has(detected.mime) &&
      detected.mime !== primaryExpectedType
    ) {
      throw new TeamDocumentValidationError(
        "CONTENT_TYPE_MISMATCH",
        "Der erkannte Dateiinhalt stimmt nicht mit Dateiendung und Inhaltstyp überein.",
      );
    }
  } else if (
    !detected ||
    detected.mime !== primaryExpectedType ||
    (extension === "jpeg" ? detected.ext !== "jpg" : detected.ext !== extension)
  ) {
    throw new TeamDocumentValidationError(
      "CONTENT_TYPE_MISMATCH",
      "Der erkannte Dateiinhalt stimmt nicht mit Dateiendung und Inhaltstyp überein.",
    );
  }

  return {
    originalFilename,
    sanitizedFilename,
    contentType: declaredContentType,
    sizeBytes: input.buffer.byteLength,
  };
}
