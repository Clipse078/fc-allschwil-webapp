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
  archiveWorkspaceDocument,
  WorkspaceDocumentArchiveServiceError,
} from "@/lib/workspace/document-archive-service";

const input = {
  tenantId: "tenant-1",
  actorUserId: "user-1",
  documentId: "document-1",
};

describe("archiveWorkspaceDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
    });

    mocks.update.mockImplementation(
      async ({ data }: {
        data: {
          status: WorkspaceDocumentStatus;
          archivedAt: Date;
          updatedByUserId: string;
        };
      }) => ({
        id: "document-1",
        status: data.status,
        archivedAt: data.archivedAt,
        updatedByUserId: data.updatedByUserId,
      }),
    );
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          workspaceDocument: { update: mocks.update },
          auditLog: { create: mocks.auditLogCreate },
        }),
    );
  });

  it("archives an active tenant document", async () => {
    const result = await archiveWorkspaceDocument(input);

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

    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        entityId: "document-1",
        action: "PRIVATE_DOCUMENT_ARCHIVED",
      }),
    });

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      data: {
        status: WorkspaceDocumentStatus.ARCHIVED,
        archivedAt: expect.any(Date),
        updatedByUserId: "user-1",
      },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        updatedByUserId: true,
      },
    });

    expect(result).toEqual({
      documentId: "document-1",
      status: WorkspaceDocumentStatus.ARCHIVED,
      archivedAt: expect.any(Date),
      updatedByUserId: "user-1",
    });
  });

  it("populates archivedAt with a current date", async () => {
    const before = Date.now();

    const result = await archiveWorkspaceDocument(input);

    const after = Date.now();

    expect(result.archivedAt.getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(result.archivedAt.getTime()).toBeLessThanOrEqual(
      after,
    );
  });

  it("rejects a document belonging to another tenant", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-2",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: null,
    });

    await expect(
      archiveWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentArchiveServiceError",
      code: "TENANT_FORBIDDEN",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a missing document", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      archiveWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentArchiveServiceError",
      code: "DOCUMENT_NOT_FOUND",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a document with ARCHIVED status", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ARCHIVED,
      archivedAt: new Date("2026-07-19T10:00:00.000Z"),
    });

    await expect(
      archiveWorkspaceDocument(input),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentArchiveServiceError",
      code: "DOCUMENT_ALREADY_ARCHIVED",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent document with archivedAt populated", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "document-1",
      tenantId: "tenant-1",
      status: WorkspaceDocumentStatus.ACTIVE,
      archivedAt: new Date("2026-07-19T10:00:00.000Z"),
    });

    await expect(
      archiveWorkspaceDocument(input),
    ).rejects.toMatchObject({
      code: "DOCUMENT_ALREADY_ARCHIVED",
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not access blob storage or document versions", async () => {
    await archiveWorkspaceDocument(input);

    const updateArgument = mocks.update.mock.calls[0]?.[0];

    expect(updateArgument).not.toHaveProperty(
      "data.storageKey",
    );
    expect(updateArgument).not.toHaveProperty(
      "data.storageUrl",
    );
    expect(updateArgument).not.toHaveProperty(
      "data.currentVersionId",
    );
    expect(updateArgument).not.toHaveProperty(
      "data.versions",
    );
  });

  it.each([
    ["tenantId", { tenantId: " " }],
    ["actorUserId", { actorUserId: "" }],
    ["documentId", { documentId: "   " }],
  ])(
    "rejects an empty required %s",
    async (_field, patch) => {
      await expect(
        archiveWorkspaceDocument({
          ...input,
          ...patch,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("exposes stable typed service errors", () => {
    const error =
      new WorkspaceDocumentArchiveServiceError(
        "DOCUMENT_NOT_FOUND",
        "Missing.",
      );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(
      "WorkspaceDocumentArchiveServiceError",
    );
    expect(error.code).toBe("DOCUMENT_NOT_FOUND");
    expect(error.message).toBe("Missing.");
  });
});
