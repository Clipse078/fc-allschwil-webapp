import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";
import { sanitizeWorkspaceFilename } from "@/lib/workspace/upload-types";

export type CommunicationStorageUploadResult = {
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
};

export type CommunicationStorageDownloadResult = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  sizeBytes: number;
};

export interface CommunicationAttachmentStorage {
  upload(input: {
    storageKey: string;
    contentType: string;
    buffer: Uint8Array;
  }): Promise<CommunicationStorageUploadResult>;
  download(input: {
    storageKey: string;
    filename: string;
    contentType: string;
  }): Promise<CommunicationStorageDownloadResult>;
  delete(storageKey: string): Promise<void>;
}

function safePathSegment(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error(`${field} contains unsupported storage path characters.`);
  }
  return normalized;
}

export function getCommunicationStorageKey(input: {
  tenantId: string;
  attachmentId: string;
  filename: string;
}): string {
  return [
    "communication",
    safePathSegment(input.tenantId, "tenantId"),
    safePathSegment(input.attachmentId, "attachmentId"),
    sanitizeWorkspaceFilename(input.filename),
  ].join("/");
}

export class WorkspaceBlobCommunicationStorage
  implements CommunicationAttachmentStorage
{
  async upload(input: {
    storageKey: string;
    contentType: string;
    buffer: Uint8Array;
  }): Promise<CommunicationStorageUploadResult> {
    return workspaceStorageProvider.uploadImmutable(input);
  }

  async download(input: {
    storageKey: string;
    filename: string;
    contentType: string;
  }): Promise<CommunicationStorageDownloadResult> {
    const result = await workspaceStorageProvider.download({
      storageReference: input.storageKey,
      filename: input.filename,
      mimeType: input.contentType,
    });
    if (!result.ok) {
      throw new CommunicationAttachmentStorageError(result.status, result.error);
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

export class CommunicationAttachmentStorageError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CommunicationAttachmentStorageError";
  }
}

export const communicationAttachmentStorage =
  new WorkspaceBlobCommunicationStorage();

export async function readStorageStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        throw new Error("Stored object exceeds the allowed snapshot size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
