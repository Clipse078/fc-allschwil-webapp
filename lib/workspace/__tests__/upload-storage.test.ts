import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  blobMocks,
  MockBlobAccessError,
  MockBlobStoreNotFoundError,
  MockBlobStoreSuspendedError,
  MockBlobClientTokenExpiredError,
} = vi.hoisted(() => {
  class MockBlobError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BlobError";
    }
  }

  class MockBlobAccessError extends MockBlobError {
    constructor() {
      super("Access denied");
      this.name = "BlobAccessError";
    }
  }

  class MockBlobStoreNotFoundError extends MockBlobError {
    constructor() {
      super("Blob store not found");
      this.name = "BlobStoreNotFoundError";
    }
  }

  class MockBlobStoreSuspendedError extends MockBlobError {
    constructor() {
      super("Blob store suspended");
      this.name = "BlobStoreSuspendedError";
    }
  }

  class MockBlobClientTokenExpiredError extends MockBlobError {
    constructor() {
      super("Token expired");
      this.name = "BlobClientTokenExpiredError";
    }
  }

  return {
    blobMocks: {
      put: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    },
    MockBlobAccessError,
    MockBlobStoreNotFoundError,
    MockBlobStoreSuspendedError,
    MockBlobClientTokenExpiredError,
  };
});

vi.mock("@vercel/blob", () => ({
  put: blobMocks.put,
  get: blobMocks.get,
  del: blobMocks.del,
  BlobAccessError: MockBlobAccessError,
  BlobStoreNotFoundError: MockBlobStoreNotFoundError,
  BlobStoreSuspendedError: MockBlobStoreSuspendedError,
  BlobClientTokenExpiredError: MockBlobClientTokenExpiredError,
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

  it("returns 503 when Blob download storage is not configured", async () => {
    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: "workspace/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      ok: false,
      status: 503,
      error:
        "Workspace-Download ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
    });

    expect(blobMocks.get).not.toHaveBeenCalled();
  });

  it("rejects an empty download storage reference", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: "   ",
      filename: "file.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Ungültige Speicherreferenz.",
    });

    expect(blobMocks.get).not.toHaveBeenCalled();
  });

  it("downloads a private blob with metadata", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream,
      headers: new Headers(),
      blob: {
        url: "https://blob.example.test/file.pdf",
        downloadUrl:
          "https://blob.example.test/file.pdf?download=1",
        pathname: "workspace/file.pdf",
        contentDisposition: 'attachment; filename="file.pdf"',
        cacheControl: "public, max-age=31536000",
        uploadedAt: new Date("2026-07-17T12:00:00.000Z"),
        etag: "test-etag",
        contentType: "application/pdf",
        size: 3,
      },
    });

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: " workspace/file.pdf ",
      filename: "../file.pdf",
      mimeType: "application/octet-stream",
    });

    expect(blobMocks.get).toHaveBeenCalledWith(
      "workspace/file.pdf",
      {
        access: "private",
        token: "test-token",
      },
    );

    expect(result).toEqual({
      ok: true,
      stream,
      filename: "file.pdf",
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="file.pdf"',
      sizeBytes: 3,
      etag: "test-etag",
    });
  });

  it("returns 404 when the Blob does not exist", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.get.mockResolvedValue(null);

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: "workspace/missing.pdf",
      filename: "missing.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "Die Datei wurde im Speicher nicht gefunden.",
    });
  });

  it("returns a controlled error when Blob download fails", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    blobMocks.get.mockRejectedValue(
      new Error("Simulated Blob download failure"),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: "workspace/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Die Datei konnte nicht geladen werden.",
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

describe("Workspace storage: BlobError classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  });

  it.each([
    ["BlobAccessError", () => new MockBlobAccessError()],
    ["BlobStoreNotFoundError", () => new MockBlobStoreNotFoundError()],
    ["BlobStoreSuspendedError", () => new MockBlobStoreSuspendedError()],
    ["BlobClientTokenExpiredError", () => new MockBlobClientTokenExpiredError()],
  ])(
    "returns 503 when upload throws %s (configuration error)",
    async (_name, makeError) => {
      blobMocks.put.mockRejectedValue(makeError());

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
        buffer: new Uint8Array([1, 2, 3]),
      });

      expect(result).toEqual({
        ok: false,
        status: 503,
        error:
          "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      });

      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    },
  );

  it.each([
    ["BlobAccessError", () => new MockBlobAccessError()],
    ["BlobStoreNotFoundError", () => new MockBlobStoreNotFoundError()],
    ["BlobStoreSuspendedError", () => new MockBlobStoreSuspendedError()],
    ["BlobClientTokenExpiredError", () => new MockBlobClientTokenExpiredError()],
  ])(
    "returns 503 when download throws %s (configuration error)",
    async (_name, makeError) => {
      blobMocks.get.mockRejectedValue(makeError());

      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const storage = new VercelBlobWorkspaceStorage();

      const result = await storage.download({
        storageReference: "workspace/file.pdf",
        filename: "file.pdf",
        mimeType: "application/pdf",
      });

      expect(result).toEqual({
        ok: false,
        status: 503,
        error:
          "Workspace-Download ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
      });

      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    },
  );

  it("still returns 500 for non-configuration Blob errors during upload", async () => {
    blobMocks.put.mockRejectedValue(new Error("Network timeout"));

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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Die Datei konnte nicht gespeichert werden.",
    });

    consoleError.mockRestore();
  });
});