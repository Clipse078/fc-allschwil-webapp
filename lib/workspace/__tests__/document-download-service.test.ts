import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspaceDocumentForDownload: vi.fn(),
}));

vi.mock("@/lib/workspace/document-service", () => ({
  getWorkspaceDocumentForDownload:
    mocks.getWorkspaceDocumentForDownload,
}));

import {
  downloadWorkspaceDocument,
  WorkspaceDocumentDownloadServiceError,
} from "@/lib/workspace/document-download-service";

function createStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

const documentDownloadDto = {
  documentId: "document-1",
  documentName: "Trainerhandbuch",
  versionId: "version-1",
  versionNumber: 1,
  filename: "trainerhandbuch.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3,
  storageKey:
    "workspace/tenant-1/document-1/v1/trainerhandbuch.pdf",
  checksum: "checksum-1",
};

const input = {
  tenantId: "tenant-1",
  actorUserId: "user-1",
  documentId: "document-1",
};

describe("downloadWorkspaceDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads the current document version without exposing storage internals", async () => {
    const stream = createStream();

    const storageProvider = {
      download: vi.fn().mockResolvedValue({
        ok: true,
        stream,
        filename: "trainerhandbuch.pdf",
        contentType: "application/pdf",
        contentDisposition:
          'attachment; filename="trainerhandbuch.pdf"',
        sizeBytes: 3,
        etag: "etag-1",
      }),
    };

    mocks.getWorkspaceDocumentForDownload.mockResolvedValue(
      documentDownloadDto,
    );

    const result = await downloadWorkspaceDocument({
      ...input,
      storageProvider,
    });

    expect(
      mocks.getWorkspaceDocumentForDownload,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      documentId: "document-1",
    });

    expect(storageProvider.download).toHaveBeenCalledWith({
      storageReference:
        "workspace/tenant-1/document-1/v1/trainerhandbuch.pdf",
      filename: "trainerhandbuch.pdf",
      mimeType: "application/pdf",
    });

    expect(result).toEqual({
      stream,
      filename: "trainerhandbuch.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
      etag: "etag-1",
    });

    expect(result).not.toHaveProperty("storageKey");
    expect(result).not.toHaveProperty("storageUrl");
    expect(result).not.toHaveProperty("contentDisposition");
  });

  it("normalizes tenant, actor and document IDs", async () => {
    const storageProvider = {
      download: vi.fn().mockResolvedValue({
        ok: true,
        stream: createStream(),
        filename: "trainerhandbuch.pdf",
        contentType: "application/pdf",
        contentDisposition:
          'attachment; filename="trainerhandbuch.pdf"',
        sizeBytes: 3,
        etag: "",
      }),
    };

    mocks.getWorkspaceDocumentForDownload.mockResolvedValue(
      documentDownloadDto,
    );

    const result = await downloadWorkspaceDocument({
      tenantId: " tenant-1 ",
      actorUserId: " user-1 ",
      documentId: " document-1 ",
      storageProvider,
    });

    expect(
      mocks.getWorkspaceDocumentForDownload,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      documentId: "document-1",
    });

    expect(result.etag).toBeNull();
  });

  it.each([
    ["tenantId", { tenantId: "   " }],
    ["actorUserId", { actorUserId: "" }],
    ["documentId", { documentId: " " }],
  ])(
    "rejects an empty required %s",
    async (_field, patch) => {
      await expect(
        downloadWorkspaceDocument({
          ...input,
          ...patch,
          storageProvider: {
            download: vi.fn(),
          },
        }),
      ).rejects.toMatchObject({
        name: "WorkspaceDocumentDownloadServiceError",
        code: "INVALID_INPUT",
      });

      expect(
        mocks.getWorkspaceDocumentForDownload,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns DOCUMENT_NOT_FOUND when no active current document version exists", async () => {
    mocks.getWorkspaceDocumentForDownload.mockResolvedValue(
      null,
    );

    const storageProvider = {
      download: vi.fn(),
    };

    await expect(
      downloadWorkspaceDocument({
        ...input,
        storageProvider,
      }),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentDownloadServiceError",
      code: "DOCUMENT_NOT_FOUND",
      message: "Dokument nicht gefunden.",
    });

    expect(storageProvider.download).not.toHaveBeenCalled();
  });

  it("maps a missing Blob object to BLOB_NOT_FOUND", async () => {
    mocks.getWorkspaceDocumentForDownload.mockResolvedValue(
      documentDownloadDto,
    );

    const storageProvider = {
      download: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        error:
          "Die Datei wurde im Speicher nicht gefunden.",
      }),
    };

    await expect(
      downloadWorkspaceDocument({
        ...input,
        storageProvider,
      }),
    ).rejects.toMatchObject({
      code: "BLOB_NOT_FOUND",
    });
  });

  it.each([400, 500, 503])(
    "maps storage status %s to STORAGE_FAILURE",
    async (status) => {
      mocks.getWorkspaceDocumentForDownload.mockResolvedValue(
        documentDownloadDto,
      );

      const storageProvider = {
        download: vi.fn().mockResolvedValue({
          ok: false,
          status,
          error: "Storage unavailable.",
        }),
      };

      await expect(
        downloadWorkspaceDocument({
          ...input,
          storageProvider,
        }),
      ).rejects.toMatchObject({
        code: "STORAGE_FAILURE",
        message: "Storage unavailable.",
      });
    },
  );

  it("exposes stable typed service errors", () => {
    const error =
      new WorkspaceDocumentDownloadServiceError(
        "INVALID_INPUT",
        "Invalid input.",
      );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(
      "WorkspaceDocumentDownloadServiceError",
    );
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("Invalid input.");
  });
});
