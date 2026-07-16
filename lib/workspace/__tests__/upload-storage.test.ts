import { beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: blobMocks.put,
  del: blobMocks.del,
}));

import {
  VercelBlobWorkspaceStorage,
  calculateWorkspaceChecksum,
  getWorkspaceStorageKey,
} from "@/lib/workspace/upload-storage";

describe("Workspace upload storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("creates deterministic tenant-scoped storage keys", () => {
    expect(
      getWorkspaceStorageKey({
        tenantKey: "FC Allschwil",
        documentId: "Document 123",
        versionNumber: 2,
        filename: "Trainer: Handbuch.pdf",
      }),
    ).toBe(
      "workspace/fc-allschwil/document-123/v2/Trainer- Handbuch.pdf",
    );
  });

  it("normalizes unsafe tenant and document segments", () => {
    expect(
      getWorkspaceStorageKey({
        tenantKey: "../../Tenant",
        documentId: "Document/ABC",
        versionNumber: 1,
        filename: "../report.xlsx",
      }),
    ).toBe(
      "workspace/tenant/document-abc/v1/report.xlsx",
    );
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid version number %s",
    (versionNumber) => {
      expect(() =>
        getWorkspaceStorageKey({
          tenantKey: "tenant",
          documentId: "document",
          versionNumber,
          filename: "file.pdf",
        }),
      ).toThrow(
        "versionNumber must be a positive safe integer.",
      );
    },
  );

  it("calculates a deterministic SHA-256 checksum", () => {
    expect(
      calculateWorkspaceChecksum(
        new TextEncoder().encode("hello"),
      ),
    ).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("returns 503 when Blob storage is not configured", async () => {
    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 503,
      error:
        "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("rejects an invalid version number before upload", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 0,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1]),
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Ungültige Versionsnummer.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("rejects an empty buffer before upload", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array(),
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Leere Dateien können nicht hochgeladen werden.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("uploads a private blob using deterministic options", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    blobMocks.put.mockResolvedValue({
      url: "https://blob.example.test/document.pdf",
      downloadUrl: "https://blob.example.test/document.pdf?download=1",
      pathname:
        "workspace/tenant-1/document-1/v1/document.pdf",
      contentDisposition:
        'attachment; filename="document.pdf"',
      contentType: "application/pdf",
    });

    const storage = new VercelBlobWorkspaceStorage();

    const inputBuffer = new TextEncoder().encode("hello");

    const result = await storage.upload({
      tenantKey: "Tenant 1",
      documentId: "Document 1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: inputBuffer,
    });

    expect(blobMocks.put).toHaveBeenCalledTimes(1);

    expect(blobMocks.put).toHaveBeenCalledWith(
      "workspace/tenant-1/document-1/v1/document.pdf",
      expect.any(Buffer),
      {
        access: "private",
        token: "test-token",
        contentType: "application/pdf",
        addRandomSuffix: false,
        allowOverwrite: false,
      },
    );

    expect(result).toEqual({
      ok: true,
      storageKey:
        "workspace/tenant-1/document-1/v1/document.pdf",
      storageUrl:
        "https://blob.example.test/document.pdf",
      checksum:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      filename: "document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
    });
  });

  it("returns a controlled error when Blob upload fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    blobMocks.put.mockRejectedValue(
      new Error("Simulated Blob failure"),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1]),
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Die Datei konnte nicht gespeichert werden.",
    });

    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("deletes a storage reference with the configured token", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    blobMocks.del.mockResolvedValue(undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete(
      " workspace/tenant-1/document-1/v1/document.pdf ",
    );

    expect(blobMocks.del).toHaveBeenCalledWith(
      "workspace/tenant-1/document-1/v1/document.pdf",
      {
        token: "test-token",
      },
    );
  });

  it("skips deletion without a token or storage reference", async () => {
    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete("workspace/file.pdf");

    expect(blobMocks.del).not.toHaveBeenCalled();

    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    await storage.delete("   ");

    expect(blobMocks.del).not.toHaveBeenCalled();
  });

  it("handles cleanup failures without throwing", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    blobMocks.del.mockRejectedValue(
      new Error("Simulated cleanup failure"),
    );

    const consoleWarning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await expect(
      storage.delete("workspace/file.pdf"),
    ).resolves.toBeUndefined();

    expect(consoleWarning).toHaveBeenCalled();

    consoleWarning.mockRestore();
  });
});