import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadImmutable: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/workspace/upload-storage", () => ({
  workspaceStorageProvider: mocks,
}));

import {
  getCommunicationStorageKey,
  readStorageStream,
  WorkspaceBlobCommunicationStorage,
} from "@/lib/communication/attachment-storage";

describe("communication attachment storage", () => {
  it("uses an immutable tenant/attachment namespace and safe filename", () => {
    expect(
      getCommunicationStorageKey({
        tenantId: "tenant_a",
        attachmentId: "attachment-1",
        filename: "../Invoice: 2026.pdf",
      }),
    ).toBe(
      "communication/tenant_a/attachment-1/Invoice- 2026.pdf",
    );
  });

  it("reuses the private Workspace Blob provider without exposing URLs", async () => {
    mocks.uploadImmutable.mockResolvedValue({
      storageKey: "communication/tenant-a/attachment-a/file.pdf",
      checksumSha256: "sha256",
      sizeBytes: 3,
    });
    const storage = new WorkspaceBlobCommunicationStorage();
    const result = await storage.upload({
      storageKey: "communication/tenant-a/attachment-a/file.pdf",
      contentType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });
    expect(mocks.uploadImmutable).toHaveBeenCalledOnce();
    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("storageUrl");
  });

  it("reads immutable snapshot bytes and enforces the cap", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    await expect(readStorageStream(stream, 3)).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
});
