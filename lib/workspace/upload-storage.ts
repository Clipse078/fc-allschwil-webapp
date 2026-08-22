import { createHash } from "node:crypto";

// IMPORTANT: WORKSPACE_BLOB_READ_WRITE_TOKEN and WORKSPACE_BLOB_STORE_ID
// must be set in all deployment environments.
//
// Configure them in:
//   - Vercel STAGE environment: Dashboard > Project > Settings > Environment Variables
//   - Vercel Production environment: same location
//   - Local development: .env.local (never commit these values)
//
// These variables refer exclusively to the dedicated private Workspace Blob
// store (sportclubevo-workspace-stage). They must never be changed to point
// at the public asset store or any other store.
//
// Without these variables the upload route returns HTTP 503 with code
// WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED.

import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobNotFoundError,
  BlobPathnameMismatchError,
  BlobPreconditionFailedError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
  del,
  get,
  put,
} from "@vercel/blob";

import {
  getWorkspaceBlobConfig,
  WorkspaceBlobConfigError,
} from "@/lib/workspace/blob-config";
import type {
  WorkspaceStorageDownloadInput,
  WorkspaceStorageDownloadResult,
  WorkspaceStorageProvider,
  WorkspaceStorageUploadInput,
  WorkspaceStorageUploadResult,
  WorkspaceUploadErrorCode,
} from "@/lib/workspace/upload-types";
import { sanitizeWorkspaceFilename } from "@/lib/workspace/upload-types";

function isStorageConfigurationError(error: unknown): boolean {
  return (
    error instanceof BlobAccessError ||
    error instanceof BlobClientTokenExpiredError ||
    error instanceof BlobStoreNotFoundError ||
    error instanceof BlobStoreSuspendedError ||
    error instanceof BlobPathnameMismatchError
  );
}

function makeUploadFailure(
  status: number,
  code: WorkspaceUploadErrorCode,
  error: string,
) {
  return { ok: false as const, status, code, error };
}

const WORKSPACE_STORAGE_PREFIX = "workspace";

function normalizeStorageSegment(
  value: string,
  fallback: string,
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export function getWorkspaceStorageKey(input: {
  tenantKey: string;
  documentId: string;
  versionNumber: number;
  filename: string;
}): string {
  const tenantKey = normalizeStorageSegment(
    input.tenantKey,
    "tenant",
  );

  const documentId = normalizeStorageSegment(
    input.documentId,
    "document",
  );

  if (
    !Number.isSafeInteger(input.versionNumber) ||
    input.versionNumber < 1
  ) {
    throw new Error(
      "versionNumber must be a positive safe integer.",
    );
  }

  const filename = sanitizeWorkspaceFilename(input.filename);

  return [
    WORKSPACE_STORAGE_PREFIX,
    tenantKey,
    documentId,
    `v${input.versionNumber}`,
    filename,
  ].join("/");
}

export function calculateWorkspaceChecksum(
  buffer: Uint8Array,
): string {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function getErrorDetails(error: unknown): {
  class: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      class: error.constructor.name,
      message: error.message,
    };
  }

  return {
    class: typeof error,
    message: String(error),
  };
}

export class VercelBlobWorkspaceStorage
  implements WorkspaceStorageProvider
{
  /**
   * Shared low-level primitive for immutable objects in the dedicated private
   * Workspace Blob store. Domain adapters own namespace construction and
   * validation; this method never returns a Blob URL.
   */
  async uploadImmutable(input: {
    storageKey: string;
    contentType: string;
    buffer: Uint8Array;
  }): Promise<{
    storageKey: string;
    checksumSha256: string;
    sizeBytes: number;
  }> {
    const storageKey = input.storageKey.trim();
    if (!storageKey || input.buffer.byteLength === 0) {
      throw new Error("A storage key and non-empty buffer are required.");
    }

    const blobConfig = getWorkspaceBlobConfig();
    const blob = await put(storageKey, Buffer.from(input.buffer), {
      access: "private",
      token: blobConfig.token,
      storeId: blobConfig.storeId,
      contentType: input.contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return {
      storageKey: blob.pathname ?? storageKey,
      checksumSha256: calculateWorkspaceChecksum(input.buffer),
      sizeBytes: input.buffer.byteLength,
    };
  }

  async upload(
    input: WorkspaceStorageUploadInput,
  ): Promise<WorkspaceStorageUploadResult> {
    let blobConfig;

    try {
      blobConfig = getWorkspaceBlobConfig();
    } catch (configError) {
      if (configError instanceof WorkspaceBlobConfigError) {
        console.error(
          "[workspace-storage] upload failed: Workspace Blob store not configured",
          { errorClass: configError.constructor.name },
        );
      }

      return makeUploadFailure(
        503,
        "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
        "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      );
    }

    if (
      !Number.isSafeInteger(input.versionNumber) ||
      input.versionNumber < 1
    ) {
      return makeUploadFailure(
        400,
        "WORKSPACE_UPLOAD_INVALID_FILE",
        "Ungültige Versionsnummer.",
      );
    }

    if (input.buffer.byteLength === 0) {
      return makeUploadFailure(
        400,
        "WORKSPACE_UPLOAD_INVALID_FILE",
        "Leere Dateien können nicht hochgeladen werden.",
      );
    }

    const filename = sanitizeWorkspaceFilename(input.filename);

    const storageKey = getWorkspaceStorageKey({
      tenantKey: input.tenantKey,
      documentId: input.documentId,
      versionNumber: input.versionNumber,
      filename,
    });

    const checksum = calculateWorkspaceChecksum(input.buffer);

    try {
      const blob = await put(
        storageKey,
        Buffer.from(input.buffer),
        {
          access: "private",
          token: blobConfig.token,
          storeId: blobConfig.storeId,
          contentType: input.mimeType,
          addRandomSuffix: false,
          allowOverwrite: false,
        },
      );

      return {
        ok: true,
        storageKey: blob.pathname ?? storageKey,
        storageUrl: blob.url ?? null,
        checksum,
        filename,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.byteLength,
      };
    } catch (error) {
      const details = getErrorDetails(error);

      if (isStorageConfigurationError(error)) {
        console.error(
          "[workspace-storage] upload failed: storage configuration error",
          { storageKey, errorClass: details.class, errorMessage: details.message },
        );

        return makeUploadFailure(
          503,
          "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
          "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
        );
      }

      if (error instanceof BlobPreconditionFailedError) {
        console.error(
          "[workspace-storage] upload failed: blob key already exists",
          { storageKey, errorClass: details.class },
        );

        return makeUploadFailure(
          409,
          "WORKSPACE_UPLOAD_CONFLICT",
          "Eine Version dieser Datei existiert bereits im Speicher.",
        );
      }

      if (error instanceof BlobFileTooLargeError) {
        console.error(
          "[workspace-storage] upload failed: file too large for store",
          { storageKey, errorClass: details.class, errorMessage: details.message },
        );

        return makeUploadFailure(
          413,
          "WORKSPACE_UPLOAD_TOO_LARGE",
          "Die Datei überschreitet die maximale Dateigrösse des Speichers.",
        );
      }

      if (error instanceof BlobContentTypeNotAllowedError) {
        console.error(
          "[workspace-storage] upload failed: content type not allowed by store",
          { storageKey, errorClass: details.class, errorMessage: details.message },
        );

        return makeUploadFailure(
          415,
          "WORKSPACE_UPLOAD_INVALID_FILE",
          "Dieser Dateityp wird vom Speicher nicht akzeptiert.",
        );
      }

      if (error instanceof BlobServiceNotAvailable) {
        console.error(
          "[workspace-storage] upload failed: storage service unavailable",
          { storageKey, errorClass: details.class },
        );

        return makeUploadFailure(
          503,
          "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
          "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
        );
      }

      if (error instanceof BlobServiceRateLimited) {
        console.error(
          "[workspace-storage] upload failed: rate limited",
          { storageKey, errorClass: details.class },
        );

        return makeUploadFailure(
          429,
          "WORKSPACE_UPLOAD_STORAGE_FAILED",
          "Zu viele Upload-Anfragen. Bitte versuchen Sie es später erneut.",
        );
      }

      if (error instanceof BlobUnknownError) {
        console.error(
          "[workspace-storage] upload failed: unknown blob error",
          { storageKey, errorClass: details.class, errorMessage: details.message },
        );

        return makeUploadFailure(
          500,
          "WORKSPACE_UPLOAD_STORAGE_FAILED",
          "Die Datei konnte nicht gespeichert werden.",
        );
      }

      if (error instanceof BlobRequestAbortedError) {
        console.error(
          "[workspace-storage] upload failed: request aborted",
          { storageKey, errorClass: details.class },
        );

        return makeUploadFailure(
          500,
          "WORKSPACE_UPLOAD_STORAGE_FAILED",
          "Der Upload wurde unterbrochen. Bitte versuchen Sie es erneut.",
        );
      }

      console.error(
        "[workspace-storage] upload failed",
        { storageKey, errorClass: details.class, errorMessage: details.message },
      );

      return makeUploadFailure(
        500,
        "WORKSPACE_UPLOAD_STORAGE_FAILED",
        "Die Datei konnte nicht gespeichert werden.",
      );
    }
  }

  async download(
    input: WorkspaceStorageDownloadInput,
  ): Promise<WorkspaceStorageDownloadResult> {
    let blobConfig;

    try {
      blobConfig = getWorkspaceBlobConfig();
    } catch (configError) {
      if (configError instanceof WorkspaceBlobConfigError) {
        console.error(
          "[workspace-storage] download failed: Workspace Blob store not configured",
          { errorClass: (configError as WorkspaceBlobConfigError).constructor.name },
        );
      }

      return {
        ok: false,
        status: 503,
        error:
          "Workspace-Download ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      };
    }

    const storageReference = input.storageReference.trim();

    if (!storageReference) {
      return {
        ok: false,
        status: 400,
        error: "Ungültige Speicherreferenz.",
      };
    }

    try {
      const result = await get(storageReference, {
        access: "private",
        token: blobConfig.token,
        storeId: blobConfig.storeId,
      });

      if (!result) {
        return {
          ok: false,
          status: 404,
          error: "Die Datei wurde im Speicher nicht gefunden.",
        };
      }

      if (result.statusCode !== 200 || !result.stream) {
        return {
          ok: false,
          status: 500,
          error: "Die Datei konnte nicht geladen werden.",
        };
      }

      return {
        ok: true,
        stream: result.stream,
        filename: sanitizeWorkspaceFilename(input.filename),
        contentType:
          result.blob.contentType ||
          input.mimeType ||
          "application/octet-stream",
        contentDisposition: result.blob.contentDisposition,
        sizeBytes: result.blob.size,
        etag: result.blob.etag,
      };
    } catch (error) {
      const details = getErrorDetails(error);

      if (isStorageConfigurationError(error)) {
        console.error(
          "[workspace-storage] download failed: storage configuration error",
          { storageReference, errorClass: details.class, errorMessage: details.message },
        );

        return {
          ok: false,
          status: 503,
          error:
            "Workspace-Download ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
        };
      }

      if (error instanceof BlobNotFoundError) {
        console.error(
          "[workspace-storage] download failed: blob not found",
          { storageReference, errorClass: details.class },
        );

        return {
          ok: false,
          status: 404,
          error: "Die Datei wurde im Speicher nicht gefunden.",
        };
      }

      console.error(
        "[workspace-storage] download failed",
        { storageReference, errorClass: details.class, errorMessage: details.message },
      );

      return {
        ok: false,
        status: 500,
        error: "Die Datei konnte nicht geladen werden.",
      };
    }
  }

  async delete(storageReference: string): Promise<void> {
    let blobConfig;

    try {
      blobConfig = getWorkspaceBlobConfig();
    } catch {
      return;
    }

    const normalizedReference = storageReference.trim();

    if (!normalizedReference) {
      return;
    }

    try {
      await del(normalizedReference, {
        token: blobConfig.token,
        storeId: blobConfig.storeId,
      });
    } catch (error) {
      const details = getErrorDetails(error);
      console.warn(
        "[workspace-storage] cleanup failed",
        { storageReference: normalizedReference, errorClass: details.class, errorMessage: details.message },
      );
    }
  }
}

export const workspaceStorageProvider =
  new VercelBlobWorkspaceStorage();
