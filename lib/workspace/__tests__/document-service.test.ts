import {
  WorkspaceDocumentStatus,
  WorkspaceDocumentVersionStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFolderFindFirst: vi.fn(),
  workspaceDocumentFindFirst: vi.fn(),
  workspaceDocumentCreate: vi.fn(),
  workspaceDocumentUpdate: vi.fn(),
  workspaceDocumentVersionCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceFolder: {
      findFirst: mocks.workspaceFolderFindFirst,
    },
    workspaceDocument: {
      findFirst: mocks.workspaceDocumentFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createWorkspaceDocumentWithInitialVersion,
  WorkspaceDocumentServiceError,
} from "@/lib/workspace/document-service";

const validInput = {
  tenantId: "tenant-1",
  folderId: "folder-1",
  name: "Trainerhandbuch",
  filename: "trainerhandbuch.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  storageKey: "workspace/tenant-1/document-1/version-1.pdf",
  storageUrl: null,
  checksum: "abc123",
  changeNote: "Initial version",
  actorUserId: "user-1",
};

const createdDocument = {
  id: "document-1",
  tenantId: "tenant-1",
  folderId: "folder-1",
  name: "Trainerhandbuch",
  status: WorkspaceDocumentStatus.ACTIVE,
  currentVersionId: "version-1",
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  archivedAt: null,
  createdAt: new Date("2026-07-16T12:00:00.000Z"),
  updatedAt: new Date("2026-07-16T12:00:00.000Z"),
  currentVersion: {
    id: "version-1",
    documentId: "document-1",
    versionNumber: 1,
    status: WorkspaceDocumentVersionStatus.CURRENT,
    filename: "trainerhandbuch.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    storageKey: "workspace/tenant-1/document-1/version-1.pdf",
    storageUrl: null,
    checksum: "abc123",
    changeNote: "Initial version",
    createdByUserId: "user-1",
    createdAt: new Date("2026-07-16T12:00:00.000Z"),
  },
};

describe("createWorkspaceDocumentWithInitialVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.workspaceFolderFindFirst.mockResolvedValue({
      id: "folder-1",
    });

    mocks.workspaceDocumentFindFirst.mockResolvedValue(null);

    mocks.workspaceDocumentCreate.mockResolvedValue({
      id: "document-1",
    });

    mocks.workspaceDocumentVersionCreate.mockResolvedValue({
      id: "version-1",
    });

    mocks.workspaceDocumentUpdate.mockResolvedValue(createdDocument);

    mocks.transaction.mockImplementation(
      async (
        callback: (transaction: {
          workspaceDocument: {
            create: typeof mocks.workspaceDocumentCreate;
            update: typeof mocks.workspaceDocumentUpdate;
          };
          workspaceDocumentVersion: {
            create: typeof mocks.workspaceDocumentVersionCreate;
          };
        }) => Promise<unknown>,
      ) =>
        callback({
          workspaceDocument: {
            create: mocks.workspaceDocumentCreate,
            update: mocks.workspaceDocumentUpdate,
          },
          workspaceDocumentVersion: {
            create: mocks.workspaceDocumentVersionCreate,
          },
        }),
    );
  });

  it("creates a tenant-scoped document and initial version transactionally", async () => {
    const result =
      await createWorkspaceDocumentWithInitialVersion(validInput);

    expect(mocks.workspaceFolderFindFirst).toHaveBeenCalledWith({
      where: {
        id: "folder-1",
        tenantId: "tenant-1",
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    expect(mocks.workspaceDocumentFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        folderId: "folder-1",
        status: WorkspaceDocumentStatus.ACTIVE,
        name: {
          equals: "Trainerhandbuch",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    expect(mocks.workspaceDocumentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        folderId: "folder-1",
        name: "Trainerhandbuch",
        status: WorkspaceDocumentStatus.ACTIVE,
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
      },
      select: {
        id: true,
      },
    });

    expect(mocks.workspaceDocumentVersionCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        documentId: "document-1",
        versionNumber: 1,
        status: WorkspaceDocumentVersionStatus.CURRENT,
        filename: "trainerhandbuch.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        storageKey: "workspace/tenant-1/document-1/version-1.pdf",
        storageUrl: null,
        checksum: "abc123",
        changeNote: "Initial version",
        createdByUserId: "user-1",
      },
      select: {
        id: true,
      },
    });

    expect(mocks.workspaceDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "document-1",
        },
        data: {
          currentVersionId: "version-1",
        },
      }),
    );

    expect(result).toEqual(createdDocument);
  });

  it("supports documents stored at the Workspace root", async () => {
    await createWorkspaceDocumentWithInitialVersion({
      ...validInput,
      folderId: null,
    });

    expect(mocks.workspaceFolderFindFirst).not.toHaveBeenCalled();

    expect(mocks.workspaceDocumentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          folderId: null,
        }),
      }),
    );
  });

  it("normalizes required and optional text fields", async () => {
    await createWorkspaceDocumentWithInitialVersion({
      ...validInput,
      tenantId: " tenant-1 ",
      folderId: " folder-1 ",
      name: " Trainerhandbuch ",
      filename: " trainerhandbuch.pdf ",
      mimeType: " application/pdf ",
      storageKey: " workspace/key.pdf ",
      storageUrl: " https://example.test/file ",
      checksum: " abc123 ",
      changeNote: " Initial version ",
      actorUserId: " user-1 ",
    });

    expect(mocks.workspaceFolderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "folder-1",
          tenantId: "tenant-1",
        }),
      }),
    );

    expect(mocks.workspaceDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          folderId: "folder-1",
          name: "Trainerhandbuch",
          createdByUserId: "user-1",
          updatedByUserId: "user-1",
        }),
      }),
    );

    expect(mocks.workspaceDocumentVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: "trainerhandbuch.pdf",
          mimeType: "application/pdf",
          storageKey: "workspace/key.pdf",
          storageUrl: "https://example.test/file",
          checksum: "abc123",
          changeNote: "Initial version",
        }),
      }),
    );
  });

  it.each([
    ["tenantId", { tenantId: "   " }],
    ["actorUserId", { actorUserId: "" }],
    ["name", { name: " " }],
    ["filename", { filename: "" }],
    ["mimeType", { mimeType: "  " }],
    ["storageKey", { storageKey: "" }],
  ])("rejects an empty required %s", async (_field, patch) => {
    await expect(
      createWorkspaceDocumentWithInitialVersion({
        ...validInput,
        ...patch,
      }),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentServiceError",
      code: "INVALID_INPUT",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid sizeBytes value %s",
    async (sizeBytes) => {
      await expect(
        createWorkspaceDocumentWithInitialVersion({
          ...validInput,
          sizeBytes,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing, foreign-tenant, or archived folder", async () => {
    mocks.workspaceFolderFindFirst.mockResolvedValue(null);

    await expect(
      createWorkspaceDocumentWithInitialVersion(validInput),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentServiceError",
      code: "FOLDER_NOT_FOUND",
    });

    expect(mocks.workspaceDocumentFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an active duplicate name in the same tenant and folder", async () => {
    mocks.workspaceDocumentFindFirst.mockResolvedValue({
      id: "existing-document",
    });

    await expect(
      createWorkspaceDocumentWithInitialVersion(validInput),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentServiceError",
      code: "DUPLICATE_DOCUMENT_NAME",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows sizeBytes equal to zero", async () => {
    await createWorkspaceDocumentWithInitialVersion({
      ...validInput,
      sizeBytes: 0,
    });

    expect(mocks.workspaceDocumentVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sizeBytes: 0,
        }),
      }),
    );
  });

  it("converts blank optional metadata to null", async () => {
    await createWorkspaceDocumentWithInitialVersion({
      ...validInput,
      storageUrl: " ",
      checksum: "",
      changeNote: "   ",
    });

    expect(mocks.workspaceDocumentVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageUrl: null,
          checksum: null,
          changeNote: null,
        }),
      }),
    );
  });

  it("exposes stable typed service errors", () => {
    const error = new WorkspaceDocumentServiceError(
      "INVALID_INPUT",
      "Invalid input.",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("WorkspaceDocumentServiceError");
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("Invalid input.");
  });
});