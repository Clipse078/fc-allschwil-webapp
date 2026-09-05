import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  folderFindFirst: vi.fn(),
  folderUpdate: vi.fn(),
  tagCount: vi.fn(),
  assetCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    mediaFolder: {
      findFirst: mocks.folderFindFirst,
      update: mocks.folderUpdate,
    },
    mediaTag: {
      count: mocks.tagCount,
    },
    mediaAsset: {
      create: mocks.assetCreate,
    },
  },
}));

import {
  createMediaAsset,
  updateMediaFolder,
  validateMediaReferencesForTenant,
} from "@/lib/media/queries";

describe("media tenant reference isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderFindFirst.mockResolvedValue({ id: "folder-a" });
    mocks.tagCount.mockResolvedValue(0);
  });

  it("rejects a known folder ID owned by another tenant", async () => {
    mocks.folderFindFirst.mockResolvedValue(null);

    await expect(
      validateMediaReferencesForTenant("tenant-a", {
        folderId: "folder-b",
      }),
    ).resolves.toBe(false);

    expect(mocks.folderFindFirst).toHaveBeenCalledWith({
      where: {
        id: "folder-b",
        tenantId: "tenant-a",
        archivedAt: null,
      },
      select: { id: true },
    });
  });

  it("rejects tag IDs unless every tag belongs to the tenant", async () => {
    mocks.tagCount.mockResolvedValue(1);

    await expect(
      validateMediaReferencesForTenant("tenant-a", {
        tagIds: ["tag-a", "tag-b"],
      }),
    ).resolves.toBe(false);

    expect(mocks.tagCount).toHaveBeenCalledWith({
      where: {
        id: { in: ["tag-a", "tag-b"] },
        tenantId: "tenant-a",
      },
    });
  });

  it("accepts only same-tenant folder and tag references", async () => {
    mocks.tagCount.mockResolvedValue(2);

    await expect(
      validateMediaReferencesForTenant("tenant-a", {
        folderId: "folder-a",
        tagIds: ["tag-a", "tag-b"],
      }),
    ).resolves.toBe(true);
  });

  it("cannot move a Tenant A folder under a Tenant B parent", async () => {
    mocks.folderFindFirst
      .mockResolvedValueOnce({ id: "folder-a" })
      .mockResolvedValueOnce(null);

    await expect(
      updateMediaFolder("tenant-a", "folder-a", {
        parentId: "folder-b",
      }),
    ).resolves.toBeNull();

    expect(mocks.folderUpdate).not.toHaveBeenCalled();
  });

  it("cannot create a media folder traversal cycle", async () => {
    mocks.folderFindFirst
      .mockResolvedValueOnce({ id: "folder-a" })
      .mockResolvedValueOnce({ id: "folder-child" })
      .mockResolvedValueOnce({ parentId: "folder-a" });

    await expect(
      updateMediaFolder("tenant-a", "folder-a", {
        parentId: "folder-child",
      }),
    ).resolves.toBeNull();

    expect(mocks.folderUpdate).not.toHaveBeenCalled();
  });

  it("cannot create a Tenant A asset inside a Tenant B folder", async () => {
    mocks.folderFindFirst.mockResolvedValue(null);

    await expect(
      createMediaAsset({
        id: "asset-a",
        tenantId: "tenant-a",
        type: "IMAGE",
        filename: "photo.png",
        mimeType: "image/png",
        sizeBytes: 3,
        url: "https://public.example/photo.png",
        folderId: "folder-b",
      }),
    ).rejects.toThrow(
      "Media folder does not belong to the tenant.",
    );

    expect(mocks.assetCreate).not.toHaveBeenCalled();
  });
});
