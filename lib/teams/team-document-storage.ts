import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";
import { sanitizeWorkspaceFilename } from "@/lib/workspace/upload-types";

export type TeamDocumentStorageUploadResult = {
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
};

export type TeamDocumentStorageDownloadResult = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  sizeBytes: number;
};

export interface TeamDocumentStorage {
  upload(input: {
    storageKey: string;
    contentType: string;
    buffer: Uint8Array;
  }): Promise<TeamDocumentStorageUploadResult>;
  download(input: {
    storageKey: string;
    filename: string;
    contentType: string;
  }): Promise<TeamDocumentStorageDownloadResult>;
  delete(storageKey: string): Promise<void>;
}

function safePathSegment(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error(`${field} contains unsupported storage path characters.`);
  }
  return normalized;
}

export function getTeamDocumentStorageKey(input: {
  tenantKey: string;
  teamId: string;
  documentId: string;
  filename: string;
}): string {
  return [
    "team-docs",
    safePathSegment(input.tenantKey, "tenantKey"),
    safePathSegment(input.teamId, "teamId"),
    safePathSegment(input.documentId, "documentId"),
    sanitizeWorkspaceFilename(input.filename),
  ].join("/");
}

export class TeamDocumentStorageError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TeamDocumentStorageError";
  }
}

export class WorkspaceBlobTeamDocumentStorage implements TeamDocumentStorage {
  async upload(input: {
    storageKey: string;
    contentType: string;
    buffer: Uint8Array;
  }): Promise<TeamDocumentStorageUploadResult> {
    return workspaceStorageProvider.uploadImmutable(input);
  }

  async download(input: {
    storageKey: string;
    filename: string;
    contentType: string;
  }): Promise<TeamDocumentStorageDownloadResult> {
    const result = await workspaceStorageProvider.download({
      storageReference: input.storageKey,
      filename: input.filename,
      mimeType: input.contentType,
    });
    if (!result.ok) {
      throw new TeamDocumentStorageError(result.status, result.error);
    }
    return {
      stream: result.stream,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
    };
  }

  delete(storageKey: string): Promise<void> {
    return workspaceStorageProvider.delete(storageKey);
  }
}

export const teamDocumentStorage = new WorkspaceBlobTeamDocumentStorage();
