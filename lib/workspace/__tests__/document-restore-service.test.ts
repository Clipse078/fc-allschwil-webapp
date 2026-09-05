import { WorkspaceDocumentStatus } from "@prisma/client";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  auditLogCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceDocument: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  restoreWorkspaceDocument,
  WorkspaceDocumentRestoreServiceError,
} from "@/lib/workspace/document-restore-service";

const input = {
  tenantId: "tenant-1",
  actorUserId: "user-1",
  documentId: "document-1",
};

describe("restoreWorkspaceDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ARCHIVED,
      archivedAt: new Date(
        "2026-07-19T10:00:00.000Z",
      ),
    });

    mocks.update.mockResolvedValue({
      id: "document-1",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
      updatedByUserId: "user-1",
    });
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          workspaceDocument: { update: mocks.update },
          auditLog: { create: mocks.auditLogCreate },
        }),
    );
  });

  it("restores an archived document", async () => {
    const result = await restoreWorkspaceDocument(input);

    expect(result).toEqual({
      documentId: "document-1",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
      updatedByUserId: "user-1",
    });
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        entityId: "document-1",
        action: "PRIVATE_DOCUMENT_RESTORED",
      }),
    });
  });

  it("loads the document without an active-only filter", async () => {
    await restoreWorkspaceDocument(input);

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        archivedAt: true,
      },
    });
  });

  it("sets status to ACTIVE", async () => {
    await restoreWorkspaceDocument(input);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkspaceDocumentStatus.ACTIVE,
        }),
      }),
    );
  });

  it("clears archivedAt", async () => {
    await restoreWorkspaceDocument(input);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          archivedAt: null,
        }),
      }),
    );
  });

  it("updates updatedByUserId", async () => {
    await restoreWorkspaceDocument(input);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updatedByUserId: "user-1",
        }),
      }),
    );
  });

  it("rejects a missing document", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      restoreWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentRestoreServiceError",
      code: "DOCUMENT_NOT_FOUND",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a document from another tenant", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-2",
      status: WorkspaceDocumentStatus.ARCHIVED,
      archivedAt: new Date(),
    });

    await expect(
      restoreWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentRestoreServiceError",
      code: "TENANT_FORBIDDEN",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an ACTIVE document", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
    });

    await expect(
      restoreWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentRestoreServiceError",
      code: "DOCUMENT_ALREADY_ACTIVE",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a document with archivedAt null", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ARCHIVED,
      archivedAt: null,
    });

    await expect(
      restoreWorkspaceDocument(input),
    ).rejects.toMatchObject({
      code: "DOCUMENT_ALREADY_ACTIVE",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not modify blob storage or versions", async () => {
    await restoreWorkspaceDocument(input);

    const updateArgument =
      mocks.update.mock.calls[0]?.[0];

    expect(updateArgument.data).toEqual({
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
      updatedByUserId: "user-1",
    });

    expect(updateArgument.data).not.toHaveProperty(
      "storageKey",
    );

    expect(updateArgument.data).not.toHaveProperty(
      "storageUrl",
    );

    expect(updateArgument.data).not.toHaveProperty(
      "blobPath",
    );

    expect(updateArgument.data).not.toHaveProperty(
      "blobUrl",
    );

    expect(updateArgument.data).not.toHaveProperty(
      "currentVersionId",
    );

    expect(updateArgument.data).not.toHaveProperty(
      "versions",
    );
  });

  it.each([
    [
      "tenantId",
      {
        tenantId: " ",
      },
    ],
    [
      "actorUserId",
      {
        actorUserId: "",
      },
    ],
    [
      "documentId",
      {
        documentId: "   ",
      },
    ],
  ])(
    "rejects an empty required %s",
    async (_field, patch) => {
      await expect(
        restoreWorkspaceDocument({
          ...input,
          ...patch,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(
        mocks.findUnique,
      ).not.toHaveBeenCalled();

      expect(
        mocks.update,
      ).not.toHaveBeenCalled();
    },
  );

  it("exposes typed restore service errors", () => {
    const error =
      new WorkspaceDocumentRestoreServiceError(
        "DOCUMENT_ALREADY_ACTIVE",
        "Already active.",
      );

    expect(error).toBeInstanceOf(Error);

    expect(error.name).toBe(
      "WorkspaceDocumentRestoreServiceError",
    );

    expect(error.code).toBe(
      "DOCUMENT_ALREADY_ACTIVE",
    );
  });
});
