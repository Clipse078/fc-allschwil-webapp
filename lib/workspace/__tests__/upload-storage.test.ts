import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  blobMocks,
  MockBlobAccessError,
  MockBlobStoreNotFoundError,
  MockBlobStoreSuspendedError,
  MockBlobClientTokenExpiredError,
  MockBlobPreconditionFailedError,
  MockBlobFileTooLargeError,
  MockBlobContentTypeNotAllowedError,
  MockBlobUnknownError,
  MockBlobNotFoundError,
  MockBlobRequestAbortedError,
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

  class MockBlobPreconditionFailedError extends MockBlobError {
    constructor() {
      super("Precondition failed");
      this.name = "BlobPreconditionFailedError";
    }
  }

  class MockBlobFileTooLargeError extends MockBlobError {
    constructor() {
      super("File too large");
      this.name = "BlobFileTooLargeError";
    }
  }

  class MockBlobContentTypeNotAllowedError extends MockBlobError {
    constructor() {
      super("Content type not allowed");
      this.name = "BlobContentTypeNotAllowedError";
    }
  }

  class MockBlobUnknownError extends MockBlobError {
    constructor() {
      super("Unknown blob error");
      this.name = "BlobUnknownError";
    }
  }

  class MockBlobNotFoundError extends MockBlobError {
    constructor() {
      super("Blob not found");
      this.name = "BlobNotFoundError";
    }
  }

  class MockBlobRequestAbortedError extends MockBlobError {
    constructor() {
      super("Request aborted");
      this.name = "BlobRequestAbortedError";
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
    MockBlobPreconditionFailedError,
    MockBlobFileTooLargeError,
    MockBlobContentTypeNotAllowedError,
    MockBlobUnknownError,
    MockBlobNotFoundError,
    MockBlobRequestAbortedError,
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
  BlobPreconditionFailedError: MockBlobPreconditionFailedError,
  BlobFileTooLargeError: MockBlobFileTooLargeError,
  BlobContentTypeNotAllowedError: MockBlobContentTypeNotAllowedError,
  BlobUnknownError: MockBlobUnknownError,
  BlobNotFoundError: MockBlobNotFoundError,
  BlobRequestAbortedError: MockBlobRequestAbortedError,
  BlobPathnameMismatchError: class extends Error {
    constructor() {
      super("Pathname mismatch");
      this.name = "BlobPathnameMismatchError";
    }
  },
  BlobServiceNotAvailable: class extends Error {
    constructor() {
      super("Service not available");
      this.name = "BlobServiceNotAvailable";
    }
  },
  BlobServiceRateLimited: class extends Error {
    constructor() {
      super("Rate limited");
      this.name = "BlobServiceRateLimited";
    }
  },
}));

import {
  VercelBlobWorkspaceStorage,
  calculateWorkspaceChecksum,
  getWorkspaceStorageKey,
} from "@/lib/workspace/upload-storage";

const TEST_TOKEN = "ws-test-token";
const TEST_STORE_ID = "ws-test-store-id";

function setWorkspaceBlobEnv() {
  process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN = TEST_TOKEN;
  process.env.WORKSPACE_BLOB_STORE_ID = TEST_STORE_ID;
}

function clearWorkspaceBlobEnv() {
  delete process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN;
  delete process.env.WORKSPACE_BLOB_STORE_ID;
}

describe("Workspace upload storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorkspaceBlobEnv();
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

  it("returns 503 when WORKSPACE_BLOB_READ_WRITE_TOKEN is missing", async () => {
    process.env.WORKSPACE_BLOB_STORE_ID = TEST_STORE_ID;

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
      code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
      error:
        "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("returns 503 when WORKSPACE_BLOB_STORE_ID is missing", async () => {
    process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN = TEST_TOKEN;

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
      code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
      error:
        "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("returns 503 when both Workspace Blob variables are missing", async () => {
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
      code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
      error:
        "Workspace-Upload ist derzeit nicht verfügbar, weil der Speicher nicht konfiguriert ist.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("does not fall back to BLOB_READ_WRITE_TOKEN for uploads", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";
    process.env.WORKSPACE_BLOB_STORE_ID = TEST_STORE_ID;

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(blobMocks.put).not.toHaveBeenCalled();

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("does not fall back to BLOB_STORE_ID for uploads", async () => {
    process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN = TEST_TOKEN;
    process.env.BLOB_STORE_ID = "public-store-id";

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(blobMocks.put).not.toHaveBeenCalled();

    delete process.env.BLOB_STORE_ID;
  });

  it("rejects an invalid version number before upload", async () => {
    setWorkspaceBlobEnv();

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
      code: "WORKSPACE_UPLOAD_INVALID_FILE",
      error: "Ungültige Versionsnummer.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("rejects an empty buffer before upload", async () => {
    setWorkspaceBlobEnv();

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
      code: "WORKSPACE_UPLOAD_INVALID_FILE",
      error: "Leere Dateien können nicht hochgeladen werden.",
    });

    expect(blobMocks.put).not.toHaveBeenCalled();
  });

  it("uploads a private blob using the dedicated Workspace store", async () => {
    setWorkspaceBlobEnv();

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
        token: TEST_TOKEN,
        storeId: TEST_STORE_ID,
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

  it("upload never uses BLOB_READ_WRITE_TOKEN even when it is present", async () => {
    setWorkspaceBlobEnv();
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";

    blobMocks.put.mockResolvedValue({
      url: "https://blob.example.test/document.pdf",
      downloadUrl: "https://blob.example.test/document.pdf?download=1",
      pathname: "workspace/tenant-1/document-1/v1/document.pdf",
      contentDisposition: 'attachment; filename="document.pdf"',
      contentType: "application/pdf",
    });

    const storage = new VercelBlobWorkspaceStorage();

    await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new TextEncoder().encode("hello"),
    });

    const callArgs = blobMocks.put.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(callArgs.token).toBe(TEST_TOKEN);
    expect(callArgs.token).not.toBe("public-store-token");

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("returns a controlled error when Blob upload fails", async () => {
    setWorkspaceBlobEnv();

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
      code: "WORKSPACE_UPLOAD_STORAGE_FAILED",
      error: "Die Datei konnte nicht gespeichert werden.",
    });

    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("returns 503 when WORKSPACE_BLOB_READ_WRITE_TOKEN is missing for download", async () => {
    process.env.WORKSPACE_BLOB_STORE_ID = TEST_STORE_ID;

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

  it("returns 503 when WORKSPACE_BLOB_STORE_ID is missing for download", async () => {
    process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN = TEST_TOKEN;

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

  it("does not fall back to BLOB_READ_WRITE_TOKEN for downloads", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";
    process.env.WORKSPACE_BLOB_STORE_ID = TEST_STORE_ID;

    const storage = new VercelBlobWorkspaceStorage();

    const result = await storage.download({
      storageReference: "workspace/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(blobMocks.get).not.toHaveBeenCalled();

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("rejects an empty download storage reference", async () => {
    setWorkspaceBlobEnv();

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

  it("downloads a private blob using the dedicated Workspace store", async () => {
    setWorkspaceBlobEnv();

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
        token: TEST_TOKEN,
        storeId: TEST_STORE_ID,
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

  it("download never uses BLOB_READ_WRITE_TOKEN even when it is present", async () => {
    setWorkspaceBlobEnv();
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";

    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream(),
      headers: new Headers(),
      blob: {
        url: "https://blob.example.test/file.pdf",
        downloadUrl: "https://blob.example.test/file.pdf?download=1",
        pathname: "workspace/file.pdf",
        contentDisposition: 'attachment; filename="file.pdf"',
        cacheControl: "public, max-age=31536000",
        uploadedAt: new Date("2026-07-17T12:00:00.000Z"),
        etag: "test-etag",
        contentType: "application/pdf",
        size: 1,
      },
    });

    const storage = new VercelBlobWorkspaceStorage();

    await storage.download({
      storageReference: "workspace/file.pdf",
      filename: "file.pdf",
      mimeType: "application/pdf",
    });

    const callArgs = blobMocks.get.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs.token).toBe(TEST_TOKEN);
    expect(callArgs.token).not.toBe("public-store-token");

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("returns 404 when the Blob does not exist", async () => {
    setWorkspaceBlobEnv();
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
    setWorkspaceBlobEnv();

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

  it("deletes a storage reference using the dedicated Workspace store", async () => {
    setWorkspaceBlobEnv();

    blobMocks.del.mockResolvedValue(undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete(
      " workspace/tenant-1/document-1/v1/document.pdf ",
    );

    expect(blobMocks.del).toHaveBeenCalledWith(
      "workspace/tenant-1/document-1/v1/document.pdf",
      {
        token: TEST_TOKEN,
        storeId: TEST_STORE_ID,
      },
    );
  });

  it("skips deletion when Workspace Blob store is not configured", async () => {
    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete("workspace/file.pdf");

    expect(blobMocks.del).not.toHaveBeenCalled();
  });

  it("skips deletion for an empty storage reference", async () => {
    setWorkspaceBlobEnv();

    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete("   ");

    expect(blobMocks.del).not.toHaveBeenCalled();
  });

  it("does not fall back to BLOB_READ_WRITE_TOKEN for cleanup", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";

    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete("workspace/file.pdf");

    expect(blobMocks.del).not.toHaveBeenCalled();

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("cleanup uses the dedicated Workspace store token and store ID", async () => {
    setWorkspaceBlobEnv();
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";

    blobMocks.del.mockResolvedValue(undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await storage.delete("workspace/tenant-1/document-1/v1/document.pdf");

    const callArgs = blobMocks.del.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs.token).toBe(TEST_TOKEN);
    expect(callArgs.token).not.toBe("public-store-token");
    expect(callArgs.storeId).toBe(TEST_STORE_ID);

    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("handles cleanup failures without throwing", async () => {
    setWorkspaceBlobEnv();
    const storageReference =
      "https://store.public.blob.vercel-storage.com/private/object.pdf";
    const providerSecret = "provider-secret-bearing-error";

    blobMocks.del.mockRejectedValue(
      new Error(`${providerSecret}: failed deleting ${storageReference}`),
    );

    const consoleWarning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await expect(
      storage.delete(storageReference),
    ).resolves.toBeUndefined();

    expect(consoleWarning).toHaveBeenCalled();
    const serializedLogs = JSON.stringify(consoleWarning.mock.calls);
    expect(serializedLogs).not.toContain(storageReference);
    expect(serializedLogs).not.toContain(providerSecret);
    expect(serializedLogs).toContain("Error");

    consoleWarning.mockRestore();
  });
});

describe("Workspace storage: BlobError classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWorkspaceBlobEnv();
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
        code: "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED",
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
      code: "WORKSPACE_UPLOAD_STORAGE_FAILED",
      error: "Die Datei konnte nicht gespeichert werden.",
    });

    consoleError.mockRestore();
  });

  it("returns 409 with WORKSPACE_UPLOAD_CONFLICT when blob key already exists", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobPreconditionFailedError(),
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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "WORKSPACE_UPLOAD_CONFLICT",
      error: "Eine Version dieser Datei existiert bereits im Speicher.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns 413 with WORKSPACE_UPLOAD_TOO_LARGE when file exceeds store limit", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobFileTooLargeError(),
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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 413,
      code: "WORKSPACE_UPLOAD_TOO_LARGE",
      error: "Die Datei überschreitet die maximale Dateigrösse des Speichers.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns 415 with WORKSPACE_UPLOAD_INVALID_FILE when content type is rejected", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobContentTypeNotAllowedError(),
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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 415,
      code: "WORKSPACE_UPLOAD_INVALID_FILE",
      error: "Dieser Dateityp wird vom Speicher nicht akzeptiert.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns 500 with WORKSPACE_UPLOAD_STORAGE_FAILED when BlobUnknownError is thrown", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobUnknownError(),
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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "WORKSPACE_UPLOAD_STORAGE_FAILED",
      error: "Die Datei konnte nicht gespeichert werden.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns 500 with WORKSPACE_UPLOAD_STORAGE_FAILED when BlobRequestAbortedError is thrown", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobRequestAbortedError(),
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
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "WORKSPACE_UPLOAD_STORAGE_FAILED",
      error: "Der Upload wurde unterbrochen. Bitte versuchen Sie es erneut.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns 404 when BlobNotFoundError is thrown during download", async () => {
    blobMocks.get.mockRejectedValue(
      new MockBlobNotFoundError(),
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
      status: 404,
      error: "Die Datei wurde im Speicher nicht gefunden.",
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("logs structured error details including error class name but not the token", async () => {
    blobMocks.put.mockRejectedValue(
      new MockBlobUnknownError(),
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const storage = new VercelBlobWorkspaceStorage();

    await storage.upload({
      tenantKey: "tenant-1",
      documentId: "document-1",
      versionNumber: 1,
      filename: "document.pdf",
      mimeType: "application/pdf",
      buffer: new Uint8Array([1, 2, 3]),
    });

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("[workspace-storage]"),
      expect.objectContaining({
        errorClass: expect.stringContaining("BlobUnknownError"),
      }),
    );

    const loggedArgs = consoleError.mock.calls
      .flat()
      .map((a) => JSON.stringify(a))
      .join(" ");

    expect(loggedArgs).not.toContain(TEST_TOKEN);
    expect(loggedArgs).not.toContain(TEST_STORE_ID);

    consoleError.mockRestore();
  });
});
