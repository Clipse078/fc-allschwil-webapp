import { createHash } from "node:crypto";

import { del, get, put } from "@vercel/blob";

import type {
  WorkspaceStorageDownloadInput,
  WorkspaceStorageDownloadResult,
  WorkspaceStorageProvider,
  WorkspaceStorageUploadInput,
  WorkspaceStorageUploadResult,
} from "@/lib/workspace/upload-types";
import { sanitizeWorkspaceFilename } from "@/lib/workspace/upload-types";

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

export class VercelBlobWorkspaceStorage
  implements WorkspaceStorageProvider
{
  async upload(
    input: WorkspaceStorageUploadInput,
  ): Promise<WorkspaceStorageUploadResult> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      return {
        ok: false,
        status: 503,
        error:
          "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      };
    }

    if (
      !Number.isSafeInteger(input.versionNumber) ||
      input.versionNumber < 1
    ) {
      return {
        ok: false,
        status: 400,
        error: "Ungültige Versionsnummer.",
      };
    }

    if (input.buffer.byteLength === 0) {
      return {
        ok: false,
        status: 400,
        error: "Leere Dateien können nicht hochgeladen werden.",
      };
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
          token,
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
      console.error(
        "[workspace-storage] upload failed",
        storageKey,
        error,
      );

      return {
        ok: false,
        status: 500,
        error: "Die Datei konnte nicht gespeichert werden.",
      };
    }
  }

  async download(
    input: WorkspaceStorageDownloadInput,
  ): Promise<WorkspaceStorageDownloadResult> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const storageReference = input.storageReference.trim();

    if (!token) {
      return {
        ok: false,
        status: 503,
        error:
          "Workspace-Download ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      };
    }

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
        token,
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
      console.error(
        "[workspace-storage] download failed",
        storageReference,
        error,
      );

      return {
        ok: false,
        status: 500,
        error: "Die Datei konnte nicht geladen werden.",
      };
    }
  }

  async delete(storageReference: string): Promise<void> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const normalizedReference = storageReference.trim();

    if (!token || !normalizedReference) {
      return;
    }

    try {
      await del(normalizedReference, {
        token,
      });
    } catch (error) {
      console.warn(
        "[workspace-storage] cleanup failed",
        normalizedReference,
        error,
      );
    }
  }
}

export const workspaceStorageProvider =
  new VercelBlobWorkspaceStorage();