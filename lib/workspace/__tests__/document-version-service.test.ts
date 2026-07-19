import {
  WorkspaceDocumentStatus,
  WorkspaceDocumentVersionStatus,
} from "@prisma/client";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceDocumentFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceDocument: {
      findFirst: mocks.workspaceDocumentFindFirst,
    },
  },
}));

import {
  getDocumentVersions,
  WorkspaceDocumentVersionServiceError,
} from "@/lib/workspace/document-version-service";

const input = {
  tenantId: "tenant-1",
  actorUserId: "user-1",
  documentId: "document-1",
};

describe("getDocumentVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all versions newest first and flags the current version", async () => {
    const version3CreatedAt = new Date(
      "2026-07-18T12:00:00.000Z",
    );

    const version2CreatedAt = new Date(
      "2026-07-17T12:00:00.000Z",
    );

    const version1CreatedAt = new Date(
      "2026-07-16T12:00:00.000Z",
    );

    mocks.workspaceDocumentFindFirst.mockResolvedValue({
      currentVersionId: "version-3",
      versions: [
        {
          id: "version-3",
          versionNumber: 3,
          createdAt: version3CreatedAt,
          createdByUserId: "user-3",
          filename: "trainer-handbook-v3.pdf",
          mimeType: "application/pdf",
          sizeBytes: 3072,
          checksum: "checksum-3",
          status: WorkspaceDocumentVersionStatus.CURRENT,
        },
        {
          id: "version-2",
          versionNumber: 2,
          createdAt: version2CreatedAt,
          createdByUserId: "user-2",
          filename: "trainer-handbook-v2.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          checksum: "checksum-2",
          status: WorkspaceDocumentVersionStatus.SUPERSEDED,
        },
        {
          id: "version-1",
          versionNumber: 1,
          createdAt: version1CreatedAt,
          createdByUserId: null,
          filename: "trainer-handbook.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          checksum: null,
          status: WorkspaceDocumentVersionStatus.SUPERSEDED,
        },
      ],
    });

    const result = await getDocumentVersions(input);

    expect(
      mocks.workspaceDocumentFindFirst,
    ).toHaveBeenCalledWith({
      where: {
        id: "document-1",
        tenantId: "tenant-1",
        status: WorkspaceDocumentStatus.ACTIVE,
        archivedAt: null,
      },
      select: {
        currentVersionId: true,
        versions: {
          orderBy: [
            {
              versionNumber: "desc",
            },
            {
              createdAt: "desc",
            },
            {
              id: "desc",
            },
          ],
          select: {
            id: true,
            versionNumber: true,
            createdAt: true,
            createdByUserId: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            checksum: true,
            status: true,
          },
        },
      },
    });

    expect(result).toEqual([
      {
        id: "version-3",
        versionNumber: 3,
        createdAt: version3CreatedAt,
        createdByUserId: "user-3",
        createdByName: null,
        filename: "trainer-handbook-v3.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3072,
        checksum: "checksum-3",
        status: WorkspaceDocumentVersionStatus.CURRENT,
        isCurrent: true,
      },
      {
        id: "version-2",
        versionNumber: 2,
        createdAt: version2CreatedAt,
        createdByUserId: "user-2",
        createdByName: null,
        filename: "trainer-handbook-v2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        checksum: "checksum-2",
        status: WorkspaceDocumentVersionStatus.SUPERSEDED,
        isCurrent: false,
      },
      {
        id: "version-1",
        versionNumber: 1,
        createdAt: version1CreatedAt,
        createdByUserId: null,
        createdByName: null,
        filename: "trainer-handbook.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        checksum: null,
        status: WorkspaceDocumentVersionStatus.SUPERSEDED,
        isCurrent: false,
      },
    ]);
  });

  it("returns an empty array for an existing document without versions", async () => {
    mocks.workspaceDocumentFindFirst.mockResolvedValue({
      currentVersionId: null,
      versions: [],
    });

    await expect(
      getDocumentVersions(input),
    ).resolves.toEqual([]);
  });

  it("returns null when the document does not exist", async () => {
    mocks.workspaceDocumentFindFirst.mockResolvedValue(null);

    await expect(
      getDocumentVersions(input),
    ).resolves.toBeNull();
  });

  it("returns null for a document belonging to another tenant", async () => {
    mocks.workspaceDocumentFindFirst.mockResolvedValue(null);

    await expect(
      getDocumentVersions({
        ...input,
        tenantId: "tenant-2",
      }),
    ).resolves.toBeNull();

    expect(
      mocks.workspaceDocumentFindFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-2",
          id: "document-1",
        }),
      }),
    );
  });

  it("normalizes tenant, actor, and document IDs", async () => {
    mocks.workspaceDocumentFindFirst.mockResolvedValue({
      currentVersionId: null,
      versions: [],
    });

    await getDocumentVersions({
      tenantId: " tenant-1 ",
      actorUserId: " user-1 ",
      documentId: " document-1 ",
    });

    expect(
      mocks.workspaceDocumentFindFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          id: "document-1",
        }),
      }),
    );
  });

  it.each([
    ["tenantId", { tenantId: "   " }],
    ["actorUserId", { actorUserId: "" }],
    ["documentId", { documentId: " " }],
  ])(
    "rejects an empty required %s",
    async (_field, patch) => {
      await expect(
        getDocumentVersions({
          ...input,
          ...patch,
        }),
      ).rejects.toMatchObject({
        name: "WorkspaceDocumentVersionServiceError",
        code: "INVALID_INPUT",
      });

      expect(
        mocks.workspaceDocumentFindFirst,
      ).not.toHaveBeenCalled();
    },
  );

  it("exposes stable typed service errors", () => {
    const error =
      new WorkspaceDocumentVersionServiceError(
        "INVALID_INPUT",
        "Invalid input.",
      );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(
      "WorkspaceDocumentVersionServiceError",
    );
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("Invalid input.");
  });
});