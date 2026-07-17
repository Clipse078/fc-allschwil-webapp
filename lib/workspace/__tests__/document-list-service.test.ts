import { WorkspaceDocumentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceDocumentFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceDocument: {
      findMany: mocks.workspaceDocumentFindMany,
    },
  },
}));

import {
  listWorkspaceDocuments,
  WorkspaceDocumentServiceError,
} from "@/lib/workspace/document-service";

describe("listWorkspaceDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists active documents in a tenant-scoped folder with the exact DTO projection", async () => {
    const documentCreatedAt = new Date("2026-07-01T08:00:00.000Z");
    const documentUpdatedAt = new Date("2026-07-02T09:00:00.000Z");
    const versionCreatedAt = new Date("2026-07-01T08:05:00.000Z");

    const rows = [
      {
        id: "document-1",
        folderId: "folder-1",
        name: "Trainer handbook",
        status: WorkspaceDocumentStatus.ACTIVE,
        currentVersionId: "version-1",
        createdByUserId: "user-1",
        updatedByUserId: "user-2",
        createdAt: documentCreatedAt,
        updatedAt: documentUpdatedAt,
        currentVersion: {
          id: "version-1",
          versionNumber: 3,
          filename: "trainer-handbook-v3.pdf",
          mimeType: "application/pdf",
          sizeBytes: 245760,
          createdAt: versionCreatedAt,
        },
      },
    ];

    mocks.workspaceDocumentFindMany.mockResolvedValue(rows);

    await expect(
      listWorkspaceDocuments({
        tenantId: " tenant-1 ",
        folderId: " folder-1 ",
      }),
    ).resolves.toEqual(rows);

    expect(mocks.workspaceDocumentFindMany).toHaveBeenCalledTimes(1);

    expect(mocks.workspaceDocumentFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        folderId: "folder-1",
        status: WorkspaceDocumentStatus.ACTIVE,
        archivedAt: null,
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        id: true,
        folderId: true,
        name: true,
        status: true,
        currentVersionId: true,
        createdByUserId: true,
        updatedByUserId: true,
        createdAt: true,
        updatedAt: true,
        currentVersion: {
          select: {
            id: true,
            versionNumber: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
  });

  it("lists documents at the Workspace root when folderId is omitted", async () => {
    mocks.workspaceDocumentFindMany.mockResolvedValue([]);

    await expect(
      listWorkspaceDocuments({
        tenantId: "tenant-1",
      }),
    ).resolves.toEqual([]);

    expect(mocks.workspaceDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          folderId: null,
          status: WorkspaceDocumentStatus.ACTIVE,
          archivedAt: null,
        },
      }),
    );
  });

  it("normalizes an explicitly null folderId to the Workspace root", async () => {
    mocks.workspaceDocumentFindMany.mockResolvedValue([]);

    await listWorkspaceDocuments({
      tenantId: "tenant-1",
      folderId: null,
    });

    expect(mocks.workspaceDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          folderId: null,
        }),
      }),
    );
  });

  it("normalizes a blank folderId to the Workspace root", async () => {
    mocks.workspaceDocumentFindMany.mockResolvedValue([]);

    await listWorkspaceDocuments({
      tenantId: "tenant-1",
      folderId: "   ",
    });

    expect(mocks.workspaceDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          folderId: null,
        }),
      }),
    );
  });

  it("preserves null DTO fields and a missing current version", async () => {
    const createdAt = new Date("2026-07-03T10:00:00.000Z");
    const updatedAt = new Date("2026-07-03T10:00:00.000Z");

    const rows = [
      {
        id: "document-2",
        folderId: null,
        name: "Empty document",
        status: WorkspaceDocumentStatus.ACTIVE,
        currentVersionId: null,
        createdByUserId: null,
        updatedByUserId: null,
        createdAt,
        updatedAt,
        currentVersion: null,
      },
    ];

    mocks.workspaceDocumentFindMany.mockResolvedValue(rows);

    const result = await listWorkspaceDocuments({
      tenantId: "tenant-1",
    });

    expect(result).toEqual(rows);
    expect(result[0]).toEqual({
      id: "document-2",
      folderId: null,
      name: "Empty document",
      status: WorkspaceDocumentStatus.ACTIVE,
      currentVersionId: null,
      createdByUserId: null,
      updatedByUserId: null,
      createdAt,
      updatedAt,
      currentVersion: null,
    });
  });

  it("returns all rows from Prisma without transforming timestamps or version metadata", async () => {
    const firstCreatedAt = new Date("2026-07-05T11:00:00.000Z");
    const firstUpdatedAt = new Date("2026-07-06T12:00:00.000Z");
    const firstVersionCreatedAt = new Date("2026-07-05T11:05:00.000Z");

    const secondCreatedAt = new Date("2026-07-04T08:00:00.000Z");
    const secondUpdatedAt = new Date("2026-07-04T08:30:00.000Z");

    const rows = [
      {
        id: "document-a",
        folderId: "folder-1",
        name: "Alpha",
        status: WorkspaceDocumentStatus.ACTIVE,
        currentVersionId: "version-a",
        createdByUserId: "creator-a",
        updatedByUserId: "updater-a",
        createdAt: firstCreatedAt,
        updatedAt: firstUpdatedAt,
        currentVersion: {
          id: "version-a",
          versionNumber: 7,
          filename: "alpha.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 987654,
          createdAt: firstVersionCreatedAt,
        },
      },
      {
        id: "document-b",
        folderId: "folder-1",
        name: "Beta",
        status: WorkspaceDocumentStatus.ACTIVE,
        currentVersionId: null,
        createdByUserId: null,
        updatedByUserId: null,
        createdAt: secondCreatedAt,
        updatedAt: secondUpdatedAt,
        currentVersion: null,
      },
    ];

    mocks.workspaceDocumentFindMany.mockResolvedValue(rows);

    const result = await listWorkspaceDocuments({
      tenantId: "tenant-1",
      folderId: "folder-1",
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(rows);
    expect(result[0]?.currentVersion?.versionNumber).toBe(7);
    expect(result[0]?.currentVersion?.createdAt).toBe(
      firstVersionCreatedAt,
    );
    expect(result[1]?.currentVersion).toBeNull();
  });

  it("rejects an empty tenantId without querying Prisma", async () => {
    await expect(
      listWorkspaceDocuments({
        tenantId: "   ",
      }),
    ).rejects.toMatchObject({
      name: "WorkspaceDocumentServiceError",
      code: "INVALID_INPUT",
      message: "tenantId is required.",
    });

    expect(mocks.workspaceDocumentFindMany).not.toHaveBeenCalled();
  });
});