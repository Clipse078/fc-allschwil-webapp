import {
  describe,
  expect,
  it,
} from "vitest";

import {
  toCreateWorkspaceFolderResponseDto,
  toWorkspaceFolderDto,
  toWorkspaceFolderListResponseDto,
  type CreateWorkspaceFolderRequestDto,
  type WorkspaceFolderRecord,
} from "@/lib/workspace/folder-dto";

const folderRecord: WorkspaceFolderRecord = {
  id: "folder-1",
  parentId: null,
  name: "Trainer",
  description: "Interne Unterlagen für Trainer.",
  displayOrder: 10,
  createdByUserId: "user-1",
  updatedByUserId: "user-2",
  archivedAt: null,
  createdAt: new Date("2026-07-17T08:00:00.000Z"),
  updatedAt: new Date("2026-07-17T09:30:00.000Z"),
};

describe("workspace folder DTO", () => {
  it("serializes a folder record", () => {
    expect(
      toWorkspaceFolderDto(folderRecord),
    ).toEqual({
      id: "folder-1",
      parentId: null,
      name: "Trainer",
      description: "Interne Unterlagen für Trainer.",
      displayOrder: 10,
      createdByUserId: "user-1",
      updatedByUserId: "user-2",
      archivedAt: null,
      createdAt: "2026-07-17T08:00:00.000Z",
      updatedAt: "2026-07-17T09:30:00.000Z",
    });
  });

  it("serializes parent and archive values", () => {
    expect(
      toWorkspaceFolderDto({
        ...folderRecord,
        id: "folder-2",
        parentId: "folder-1",
        archivedAt: new Date(
          "2026-07-17T10:00:00.000Z",
        ),
      }),
    ).toMatchObject({
      id: "folder-2",
      parentId: "folder-1",
      archivedAt: "2026-07-17T10:00:00.000Z",
    });
  });

  it("serializes a folder list response", () => {
    expect(
      toWorkspaceFolderListResponseDto([
        folderRecord,
        {
          ...folderRecord,
          id: "folder-2",
          parentId: "folder-1",
          name: "Handbücher",
        },
      ]),
    ).toEqual({
      folders: [
        expect.objectContaining({
          id: "folder-1",
          name: "Trainer",
        }),
        expect.objectContaining({
          id: "folder-2",
          parentId: "folder-1",
          name: "Handbücher",
        }),
      ],
    });
  });

  it("serializes an empty folder list", () => {
    expect(
      toWorkspaceFolderListResponseDto([]),
    ).toEqual({
      folders: [],
    });
  });

  it("serializes a create-folder response", () => {
    expect(
      toCreateWorkspaceFolderResponseDto(
        folderRecord,
      ),
    ).toEqual({
      folder: expect.objectContaining({
        id: "folder-1",
        name: "Trainer",
        createdAt:
          "2026-07-17T08:00:00.000Z",
      }),
    });
  });

  it("supports a root-folder create request", () => {
    const request: CreateWorkspaceFolderRequestDto = {
      name: "Vereinsdokumente",
    };

    expect(request).toEqual({
      name: "Vereinsdokumente",
    });
  });

  it("supports a nested-folder create request", () => {
    const request: CreateWorkspaceFolderRequestDto = {
      parentId: "folder-1",
      name: "Trainer-Handbücher",
      description: "Aktuelle Trainer-Handbücher",
      displayOrder: 20,
    };

    expect(request).toEqual({
      parentId: "folder-1",
      name: "Trainer-Handbücher",
      description: "Aktuelle Trainer-Handbücher",
      displayOrder: 20,
    });
  });
});