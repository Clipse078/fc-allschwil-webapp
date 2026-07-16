export const MAX_WORKSPACE_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_WORKSPACE_MIME_TYPES = [
  "application/pdf",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "text/plain",
  "text/csv",

  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "video/mp4",
  "video/webm",

  "application/zip",
  "application/x-zip-compressed",
] as const;

export type AllowedWorkspaceMimeType =
  (typeof ALLOWED_WORKSPACE_MIME_TYPES)[number];

export type WorkspaceUploadValidationSuccess = {
  ok: true;
  filename: string;
  mimeType: AllowedWorkspaceMimeType;
  sizeBytes: number;
};

export type WorkspaceUploadValidationFailure = {
  ok: false;
  error: string;
};

export type WorkspaceUploadValidationResult =
  | WorkspaceUploadValidationSuccess
  | WorkspaceUploadValidationFailure;

export type WorkspaceStorageUploadInput = {
  tenantKey: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  mimeType: AllowedWorkspaceMimeType;
  buffer: Uint8Array;
};

export type WorkspaceStorageUploadSuccess = {
  ok: true;
  storageKey: string;
  storageUrl: string | null;
  checksum: string;
  filename: string;
  mimeType: AllowedWorkspaceMimeType;
  sizeBytes: number;
};

export type WorkspaceStorageUploadFailure = {
  ok: false;
  status: number;
  error: string;
};

export type WorkspaceStorageUploadResult =
  | WorkspaceStorageUploadSuccess
  | WorkspaceStorageUploadFailure;

export interface WorkspaceStorageProvider {
  upload(
    input: WorkspaceStorageUploadInput,
  ): Promise<WorkspaceStorageUploadResult>;

  delete(storageReference: string): Promise<void>;
}

export function isAllowedWorkspaceMimeType(
  mimeType: string,
): mimeType is AllowedWorkspaceMimeType {
  return (ALLOWED_WORKSPACE_MIME_TYPES as readonly string[]).includes(
    mimeType,
  );
}

export function sanitizeWorkspaceFilename(filename: string): string {
  const leafName = filename
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.trim();

  const sanitized = (leafName || "file")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/^\.+/, "")
    .trim();

  return sanitized || "file";
}

export function validateWorkspaceUploadFile(
  file: File,
): WorkspaceUploadValidationResult {
  if (!isAllowedWorkspaceMimeType(file.type)) {
    return {
      ok: false,
      error: `Nicht erlaubter Dateityp: ${file.type || "(unbekannt)"}.`,
    };
  }

  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    return {
      ok: false,
      error: "Ungültige Dateigrösse.",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: "Leere Dateien können nicht hochgeladen werden.",
    };
  }

  if (file.size > MAX_WORKSPACE_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const maximumMb = Math.round(
      MAX_WORKSPACE_FILE_SIZE_BYTES / 1024 / 1024,
    );

    return {
      ok: false,
      error: `Datei zu gross (${sizeMb} MB). Maximum: ${maximumMb} MB.`,
    };
  }

  return {
    ok: true,
    filename: sanitizeWorkspaceFilename(file.name),
    mimeType: file.type,
    sizeBytes: file.size,
  };
}