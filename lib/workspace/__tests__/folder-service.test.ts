import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  workspaceFolderCreateMock,
  workspaceFolderFindFirstMock,
  workspaceFolderFindManyMock,
} = vi.hoisted(() => ({
  workspaceFolderCreateMock: vi.fn(),
  workspaceFolderFindFirstMock: vi.fn(),
  workspaceFolderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspaceFolder: {
      create: workspaceFolderCreateMock,
      findFirst: workspaceFolderFindFirstMock,
      findMany: workspaceFolderFindManyMock,
    },
  },
}));

import {
  createWorkspaceFolder,
  listWorkspaceFolders,
  normalizeWorkspaceFolderName,
  WorkspaceFolderServiceError,
} from "@/lib/workspace/folder-service";

const createdAt = new Date(
  "2026-07-17T08:00:00.000Z",
);
const updatedAt = new Date(
  "2026-07-17T08:30:00.000Z",
);

const folderRecord = {
  id: "folder-1",
  parentId: null,
  name: "Trainer",
  description: null,
  displayOrder: 0,
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  archivedAt: null,
  createdAt,
  updatedAt,
};

describe("workspace folder service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listWorkspaceFolders", () => {
    it("lists active root folders for one tenant", async () => {
      workspaceFolderFindManyMock.mockResolvedValue([
        folderRecord,
      ]);

      await expect(
        listWorkspaceFolders({
          tenantId: "tenant-1",
        }),
      ).resolves.toEqual([
        folderRecord,
      ]);

      expect(
        workspaceFolderFindManyMock,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          parentId: null,
          archivedAt: null,
        },
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            name: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
        select: {
          id: true,
          parentId: true,
          name: true,
          description: true,
          displayOrder: true,
          createdByUserId: true,
          updatedByUserId: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it("trims and validates a requested parent folder", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue({
        id: "folder-parent",
      });
      workspaceFolderFindManyMock.mockResolvedValue([]);

      await listWorkspaceFolders({
        tenantId: " tenant-1 ",
        parentId: " folder-parent ",
      });

      expect(
        workspaceFolderFindFirstMock,
      ).toHaveBeenCalledWith({
        where: {
          id: "folder-parent",
          tenantId: "tenant-1",
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });

      expect(
        workspaceFolderFindManyMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: "tenant-1",
            parentId: "folder-parent",
            archivedAt: null,
          },
        }),
      );
    });

    it("normalizes a blank parent ID to the root", async () => {
      workspaceFolderFindManyMock.mockResolvedValue([]);

      await listWorkspaceFolders({
        tenantId: "tenant-1",
        parentId: "   ",
      });

      expect(
        workspaceFolderFindFirstMock,
      ).not.toHaveBeenCalled();

      expect(
        workspaceFolderFindManyMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: "tenant-1",
            parentId: null,
            archivedAt: null,
          },
        }),
      );
    });

    it("rejects a missing tenant ID", async () => {
      await expect(
        listWorkspaceFolders({
          tenantId: "   ",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(
        workspaceFolderFindManyMock,
      ).not.toHaveBeenCalled();
    });

    it("rejects a missing or cross-tenant parent folder", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue(null);

      await expect(
        listWorkspaceFolders({
          tenantId: "tenant-1",
          parentId: "folder-other",
        }),
      ).rejects.toMatchObject({
        code: "PARENT_FOLDER_NOT_FOUND",
      });

      expect(
        workspaceFolderFindManyMock,
      ).not.toHaveBeenCalled();
    });
  });

  describe("createWorkspaceFolder", () => {
    it("creates a root folder with normalized values", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue(null);
      workspaceFolderCreateMock.mockResolvedValue(
        folderRecord,
      );

      await expect(
        createWorkspaceFolder({
          tenantId: " tenant-1 ",
          name: " Trainer ",
          description: "  Interne Unterlagen  ",
          actorUserId: " user-1 ",
        }),
      ).resolves.toEqual(folderRecord);

      expect(
        workspaceFolderFindFirstMock,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          parentId: null,
          archivedAt: null,
          name: {
            equals: "Trainer",
            mode: "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

      expect(
        workspaceFolderCreateMock,
      ).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          parentId: null,
          name: "Trainer",
          description: "Interne Unterlagen",
          displayOrder: 0,
          createdByUserId: "user-1",
          updatedByUserId: "user-1",
        },
        select: {
          id: true,
          parentId: true,
          name: true,
          description: true,
          displayOrder: true,
          createdByUserId: true,
          updatedByUserId: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it("creates a nested folder after parent validation", async () => {
      workspaceFolderFindFirstMock
        .mockResolvedValueOnce({
          id: "folder-parent",
        })
        .mockResolvedValueOnce(null);

      workspaceFolderCreateMock.mockResolvedValue({
        ...folderRecord,
        id: "folder-child",
        parentId: "folder-parent",
        displayOrder: 20,
      });

      await createWorkspaceFolder({
        tenantId: "tenant-1",
        parentId: "folder-parent",
        name: "HandbÃ¼cher",
        displayOrder: 20,
        actorUserId: "user-1",
      });

      expect(
        workspaceFolderFindFirstMock,
      ).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            id: "folder-parent",
            tenantId: "tenant-1",
            archivedAt: null,
          },
          select: {
            id: true,
          },
        },
      );

      expect(
        workspaceFolderFindFirstMock,
      ).toHaveBeenNthCalledWith(
        2,
        {
          where: {
            tenantId: "tenant-1",
            parentId: "folder-parent",
            archivedAt: null,
            name: {
              equals: "HandbÃ¼cher",
              mode: "insensitive",
            },
          },
          select: {
            id: true,
          },
        },
      );
    });

    it("normalizes a blank description to null", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue(null);
      workspaceFolderCreateMock.mockResolvedValue(
        folderRecord,
      );

      await createWorkspaceFolder({
        tenantId: "tenant-1",
        name: "Trainer",
        description: "   ",
        actorUserId: "user-1",
      });

      expect(
        workspaceFolderCreateMock,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: null,
          }),
        }),
      );
    });

    it("rejects an empty folder name", async () => {
      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          name: "   ",
          actorUserId: "user-1",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(
        workspaceFolderFindFirstMock,
      ).not.toHaveBeenCalled();
      expect(
        workspaceFolderCreateMock,
      ).not.toHaveBeenCalled();
    });

    it("rejects an empty actor user ID", async () => {
      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          name: "Trainer",
          actorUserId: "   ",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(
        workspaceFolderCreateMock,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid display order", async () => {
      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          name: "Trainer",
          displayOrder: -1,
          actorUserId: "user-1",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(
        workspaceFolderCreateMock,
      ).not.toHaveBeenCalled();
    });

    it("rejects a missing or cross-tenant parent folder", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue(null);

      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          parentId: "folder-other",
          name: "Trainer",
          actorUserId: "user-1",
        }),
      ).rejects.toMatchObject({
        code: "PARENT_FOLDER_NOT_FOUND",
      });

      expect(
        workspaceFolderCreateMock,
      ).not.toHaveBeenCalled();
    });

    it("rejects a duplicate active folder name in the same parent", async () => {
      workspaceFolderFindFirstMock.mockResolvedValue({
        id: "folder-existing",
      });

      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          name: "Trainer",
          actorUserId: "user-1",
        }),
      ).rejects.toMatchObject({
        code: "WORKSPACE_FOLDER_NAME_CONFLICT",
      });

      expect(
        workspaceFolderCreateMock,
      ).not.toHaveBeenCalled();
    });

    it("allows the same folder name in a different parent", async () => {
      workspaceFolderFindFirstMock
        .mockResolvedValueOnce({
          id: "folder-parent",
        })
        .mockResolvedValueOnce(null);

      workspaceFolderCreateMock.mockResolvedValue({
        ...folderRecord,
        parentId: "folder-parent",
      });

      await expect(
        createWorkspaceFolder({
          tenantId: "tenant-1",
          parentId: "folder-parent",
          name: "Trainer",
          actorUserId: "user-1",
        }),
      ).resolves.toMatchObject({
        parentId: "folder-parent",
        name: "Trainer",
      });
    });

    it("exposes a typed service error", () => {
      const error = new WorkspaceFolderServiceError(
        "INVALID_INPUT",
        "UngÃ¼ltige Eingabe.",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(
        "WorkspaceFolderServiceError",
      );
      expect(error.code).toBe("INVALID_INPUT");
    });
  });
});

describe("normalizeWorkspaceFolderName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeWorkspaceFolderName("  Trainers  ")).toBe(
      "trainers",
    );
  });

  it("lowercases the name", () => {
    expect(normalizeWorkspaceFolderName("TRAINERS")).toBe(
      "trainers",
    );
  });

  it("trims and lowercases together", () => {
    expect(normalizeWorkspaceFolderName(" Trainers ")).toBe(
      "trainers",
    );
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeWorkspaceFolderName("   ")).toBe("");
  });
});

describe("duplicate folder name detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a root folder duplicate (exact match)", async () => {
    workspaceFolderFindFirstMock.mockResolvedValue({
      id: "folder-existing",
    });

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        name: "Trainers",
        actorUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
      message: "In diesem Ordner existiert bereits ein Ordner mit diesem Namen.",
    });

    expect(workspaceFolderCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a root folder duplicate (case-insensitive: 'trainers' vs 'Trainers')", async () => {
    workspaceFolderFindFirstMock.mockResolvedValue({
      id: "folder-existing",
    });

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        name: "trainers",
        actorUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    expect(workspaceFolderCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a root folder duplicate (whitespace-normalised: ' Trainers ')", async () => {
    workspaceFolderFindFirstMock.mockResolvedValue({
      id: "folder-existing",
    });

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        name: " Trainers ",
        actorUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    expect(workspaceFolderCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a subfolder duplicate (case-insensitive)", async () => {
    workspaceFolderFindFirstMock
      .mockResolvedValueOnce({ id: "folder-parent" })
      .mockResolvedValueOnce({ id: "folder-existing" });

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        parentId: "folder-parent",
        name: "TRAINERS",
        actorUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "WORKSPACE_FOLDER_NAME_CONFLICT",
    });

    expect(workspaceFolderCreateMock).not.toHaveBeenCalled();
  });

  it("allows the same name under a different parent", async () => {
    workspaceFolderFindFirstMock
      .mockResolvedValueOnce({ id: "folder-parent" })
      .mockResolvedValueOnce(null);

    workspaceFolderCreateMock.mockResolvedValue({
      ...folderRecord,
      parentId: "folder-parent",
    });

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        parentId: "folder-parent",
        name: "Trainers",
        actorUserId: "user-1",
      }),
    ).resolves.toMatchObject({
      parentId: "folder-parent",
    });
  });

  it("archived folders do not block creation of a new active folder with the same name", async () => {
    // The duplicate query filters archivedAt: null, so archived folders are excluded.
    // Simulate: no active duplicate found (archived one is ignored by the query filter).
    workspaceFolderFindFirstMock.mockResolvedValue(null);
    workspaceFolderCreateMock.mockResolvedValue(folderRecord);

    await expect(
      createWorkspaceFolder({
        tenantId: "tenant-1",
        name: "Trainers",
        actorUserId: "user-1",
      }),
    ).resolves.toMatchObject({
      name: "Trainer",
    });

    expect(workspaceFolderCreateMock).toHaveBeenCalledTimes(1);
  });

  it("uses mode:insensitive in the duplicate-check Prisma query", async () => {
    workspaceFolderFindFirstMock.mockResolvedValue(null);
    workspaceFolderCreateMock.mockResolvedValue(folderRecord);

    await createWorkspaceFolder({
      tenantId: "tenant-1",
      name: "Trainers",
      actorUserId: "user-1",
    });

    const duplicateCheckCall = workspaceFolderFindFirstMock.mock.calls.find(
      (call) => call[0]?.where?.name?.mode === "insensitive",
    );

    expect(duplicateCheckCall).toBeDefined();
    expect(duplicateCheckCall![0].where).toMatchObject({
      tenantId: "tenant-1",
      parentId: null,
      archivedAt: null,
      name: {
        equals: "Trainers",
        mode: "insensitive",
      },
    });
  });
});