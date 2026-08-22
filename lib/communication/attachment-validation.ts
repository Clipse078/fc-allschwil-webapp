import { fileTypeFromBuffer } from "file-type";
import { sanitizeWorkspaceFilename } from "@/lib/workspace/upload-types";
export {
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  MAX_COMMUNICATION_ATTACHMENT_TOTAL_BYTES,
  MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/communication/attachment-constants";
import {
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
  MAX_COMMUNICATION_ATTACHMENT_TOTAL_BYTES,
  MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/communication/attachment-constants";

const ALLOWED_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type AllowedCommunicationAttachmentContentType =
  (typeof ALLOWED_TYPES)[keyof typeof ALLOWED_TYPES];

export type ValidatedCommunicationAttachment = {
  originalFilename: string;
  sanitizedFilename: string;
  contentType: AllowedCommunicationAttachmentContentType;
  sizeBytes: number;
};

export type CommunicationAttachmentValidationErrorCode =
  | "INVALID_FILENAME"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "TYPE_NOT_ALLOWED"
  | "CONTENT_TYPE_MISMATCH"
  | "UNTRUSTED_TEXT_CONTENT"
  | "TOO_MANY_ATTACHMENTS"
  | "TOTAL_SIZE_EXCEEDED";

export class CommunicationAttachmentValidationError extends Error {
  constructor(
    readonly code: CommunicationAttachmentValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommunicationAttachmentValidationError";
  }
}

function filenameExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index > -1 ? filename.slice(index + 1).toLowerCase() : "";
}

function validatePlainText(buffer: Uint8Array): void {
  if (buffer.includes(0)) {
    throw new CommunicationAttachmentValidationError(
      "UNTRUSTED_TEXT_CONTENT",
      "Textdateien dürfen keine Binärdaten enthalten.",
    );
  }

  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  if (/<(?:!doctype|html|script|svg)\b/i.test(decoded)) {
    throw new CommunicationAttachmentValidationError(
      "UNTRUSTED_TEXT_CONTENT",
      "HTML-, Script- und SVG-Inhalte sind nicht erlaubt.",
    );
  }
}

/**
 * Validates extension, declared MIME and detected file signature together.
 * `file-type` identifies PDF, OOXML and supported images. TXT/CSV have no
 * reliable magic bytes, so they additionally require valid UTF-8, no NUL
 * bytes and no HTML/script/SVG marker.
 */
export async function validateCommunicationAttachment(input: {
  filename: string;
  declaredContentType: string;
  buffer: Uint8Array;
}): Promise<ValidatedCommunicationAttachment> {
  const originalFilename = input.filename.trim();
  const sanitizedFilename = sanitizeWorkspaceFilename(originalFilename);
  if (!originalFilename || !sanitizedFilename.includes(".")) {
    throw new CommunicationAttachmentValidationError(
      "INVALID_FILENAME",
      "Ein Dateiname mit erlaubter Endung ist erforderlich.",
    );
  }
  if (input.buffer.byteLength === 0) {
    throw new CommunicationAttachmentValidationError(
      "EMPTY_FILE",
      "Leere Dateien sind nicht erlaubt.",
    );
  }
  if (input.buffer.byteLength > MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES) {
    throw new CommunicationAttachmentValidationError(
      "FILE_TOO_LARGE",
      "Die Datei überschreitet 10 MiB.",
    );
  }

  const extension = filenameExtension(sanitizedFilename);
  const expectedType = ALLOWED_TYPES[extension as keyof typeof ALLOWED_TYPES];
  if (!expectedType) {
    throw new CommunicationAttachmentValidationError(
      "TYPE_NOT_ALLOWED",
      "Dieser Dateityp ist nicht erlaubt.",
    );
  }

  const declaredContentType = input.declaredContentType
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (declaredContentType !== expectedType) {
    throw new CommunicationAttachmentValidationError(
      "CONTENT_TYPE_MISMATCH",
      "Dateiendung und deklarierter Inhaltstyp stimmen nicht überein.",
    );
  }

  const detected = await fileTypeFromBuffer(input.buffer);
  if (extension === "txt" || extension === "csv") {
    if (detected) {
      throw new CommunicationAttachmentValidationError(
        "CONTENT_TYPE_MISMATCH",
        "Die Textdatei enthält einen anderen erkannten Dateityp.",
      );
    }
    validatePlainText(input.buffer);
  } else if (
    !detected ||
    detected.mime !== expectedType ||
    (extension === "jpeg" ? detected.ext !== "jpg" : detected.ext !== extension)
  ) {
    throw new CommunicationAttachmentValidationError(
      "CONTENT_TYPE_MISMATCH",
      "Der erkannte Dateiinhalt stimmt nicht mit Dateiendung und Inhaltstyp überein.",
    );
  }

  return {
    originalFilename,
    sanitizedFilename,
    contentType: expectedType,
    sizeBytes: input.buffer.byteLength,
  };
}

export function validateCommunicationAttachmentSet(
  attachments: ReadonlyArray<{ sizeBytes: number }>,
): void {
  if (attachments.length > MAX_COMMUNICATION_ATTACHMENTS_PER_MESSAGE) {
    throw new CommunicationAttachmentValidationError(
      "TOO_MANY_ATTACHMENTS",
      "Eine Nachricht darf höchstens 10 Anhänge enthalten.",
    );
  }

  const total = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);
  if (
    attachments.some(
      (item) => !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 0,
    ) ||
    !Number.isSafeInteger(total) ||
    total > MAX_COMMUNICATION_ATTACHMENT_TOTAL_BYTES
  ) {
    throw new CommunicationAttachmentValidationError(
      "TOTAL_SIZE_EXCEEDED",
      "Die Anhänge einer Nachricht dürfen zusammen höchstens 20 MiB umfassen.",
    );
  }
}
