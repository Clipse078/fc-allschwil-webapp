import {
  getWorkspaceDocumentForDownload,
} from "@/lib/workspace/document-service";
import {
  workspaceStorageProvider,
} from "@/lib/workspace/upload-storage";
import type {
  WorkspaceStorageProvider,
} from "@/lib/workspace/upload-types";

export type WorkspaceDocumentDownloadServiceErrorCode =
  | "INVALID_INPUT"
  | "DOCUMENT_NOT_FOUND"
  | "BLOB_NOT_FOUND"
  | "STORAGE_FAILURE";

export class WorkspaceDocumentDownloadServiceError extends Error {
  readonly code: WorkspaceDocumentDownloadServiceErrorCode;

  constructor(
    code: WorkspaceDocumentDownloadServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceDocumentDownloadServiceError";
    this.code = code;
  }
}

export type DownloadWorkspaceDocumentInput = {
  tenantId: string;
  actorUserId: string;
  documentId: string;
  storageProvider?: Pick<WorkspaceStorageProvider, "download">;
};

export type DownloadWorkspaceDocumentResult = {
  stream: ReadableStream<Uint8Array>;
  filename: string;
  contentType: string;
  sizeBytes: number;
  etag: string | null;
};

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new WorkspaceDocumentDownloadServiceError(
      "INVALID_INPUT",
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

/**
 * Downloads the current version of one active tenant-scoped Workspace document.
 *
 * Authorization is enforced by the API boundary. actorUserId remains mandatory
 * so this operation cannot be invoked without an authenticated actor context.
 */
export async function downloadWorkspaceDocument(
  input: DownloadWorkspaceDocumentInput,
): Promise<DownloadWorkspaceDocumentResult> {
  const tenantId = normalizeRequiredText(
    input.tenantId,
    "tenantId",
  );

  normalizeRequiredText(
    input.actorUserId,
    "actorUserId",
  );

  const documentId = normalizeRequiredText(
    input.documentId,
    "documentId",
  );

  const document = await getWorkspaceDocumentForDownload({
    tenantId,
    documentId,
  });

  if (!document) {
    throw new WorkspaceDocumentDownloadServiceError(
      "DOCUMENT_NOT_FOUND",
      "Dokument nicht gefunden.",
    );
  }

  const storageProvider =
    input.storageProvider ?? workspaceStorageProvider;

  const downloadResult = await storageProvider.download({
    storageReference: document.storageKey,
    filename: document.filename,
    mimeType: document.mimeType,
  });

  if (!downloadResult.ok) {
    if (downloadResult.status === 404) {
      throw new WorkspaceDocumentDownloadServiceError(
        "BLOB_NOT_FOUND",
        "Die Datei wurde im Speicher nicht gefunden.",
      );
    }

    throw new WorkspaceDocumentDownloadServiceError(
      "STORAGE_FAILURE",
      downloadResult.error,
    );
  }

  return {
    stream: downloadResult.stream,
    filename: downloadResult.filename,
    contentType: downloadResult.contentType,
    sizeBytes: downloadResult.sizeBytes,
    etag: downloadResult.etag || null,
  };
}
