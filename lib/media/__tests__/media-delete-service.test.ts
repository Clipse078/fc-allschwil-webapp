/**
 * ADMIN-HARD-DELETE-UI — MediaAsset delete service unit tests.
 *
 * Covers:
 *   MD-01  getMediaAssetDeletionImpact returns null for non-existent asset
 *   MD-02  getMediaAssetDeletionImpact returns null for wrong tenant
 *   MD-03  getMediaAssetDeletionImpact returns correct impact
 *   MD-04  deleteMediaAssetPermanently deletes DB row + blob
 *   MD-05  deleteMediaAssetPermanently succeeds even when blob deletion fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    mediaAsset: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/media/upload", () => ({
  deleteMediaBlob: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { deleteMediaBlob } from "@/lib/media/upload";
import {
  getMediaAssetDeletionImpact,
  deleteMediaAssetPermanently,
} from "@/lib/media/media-delete-service";

const mockPrisma = prisma as unknown as {
  mediaAsset: { findUnique: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
};

const mockDeleteBlob = deleteMediaBlob as ReturnType<typeof vi.fn>;

const TENANT_ID = "tenant-1";

describe("ADMIN-HARD-DELETE-UI — media-delete-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("MD-01: returns null for non-existent asset", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValueOnce(null);
    expect(await getMediaAssetDeletionImpact(TENANT_ID, "no-asset")).toBeNull();
  });

  it("MD-02: returns null for wrong tenant", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValueOnce({
      tenantId: "other-tenant",
      filename: "photo.jpg",
      url: "https://example.com/photo.jpg",
      sizeBytes: 1024,
      _count: { newsArticles: 0, newsArticleMedia: 0, usages: 0 },
    });
    expect(await getMediaAssetDeletionImpact(TENANT_ID, "asset-1")).toBeNull();
  });

  it("MD-03: returns correct impact", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      filename: "hero.jpg",
      url: "https://blob.example.com/hero.jpg",
      sizeBytes: 512000,
      _count: { newsArticles: 2, newsArticleMedia: 5, usages: 3 },
    });
    const result = await getMediaAssetDeletionImpact(TENANT_ID, "asset-2");
    expect(result).toMatchObject({
      filename: "hero.jpg",
      blobWillBeDeleted: true,
      newsArticleHeroRefs: 2,
      newsArticleMediaRefs: 5,
      usageRefs: 3,
    });
  });

  it("MD-04: deletes DB record and attempts blob deletion", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      filename: "img.png",
      url: "https://blob.example.com/img.png",
      sizeBytes: 2048,
      _count: { newsArticles: 0, newsArticleMedia: 0, usages: 0 },
    });
    mockPrisma.mediaAsset.delete.mockResolvedValueOnce({});
    mockDeleteBlob.mockResolvedValueOnce(undefined);

    const result = await deleteMediaAssetPermanently(TENANT_ID, "asset-3");
    expect(mockPrisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "asset-3" } });
    expect(mockDeleteBlob).toHaveBeenCalledWith("https://blob.example.com/img.png");
    expect(result?.blobDeleted).toBe(true);
  });

  it("MD-05: succeeds even when blob deletion fails (non-fatal)", async () => {
    mockPrisma.mediaAsset.findUnique.mockResolvedValueOnce({
      tenantId: TENANT_ID,
      filename: "gone.jpg",
      url: "https://blob.example.com/gone.jpg",
      sizeBytes: 100,
      _count: { newsArticles: 0, newsArticleMedia: 0, usages: 0 },
    });
    mockPrisma.mediaAsset.delete.mockResolvedValueOnce({});
    mockDeleteBlob.mockRejectedValueOnce(new Error("Blob service unavailable"));

    const result = await deleteMediaAssetPermanently(TENANT_ID, "asset-4");
    expect(result).not.toBeNull();
    expect(result?.blobDeleted).toBe(false);
  });
});
