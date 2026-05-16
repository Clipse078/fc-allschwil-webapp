import { prisma } from "@/lib/db/prisma";

export type MediaAssetListItem = {
  id: string;
  type: string;
  title: string;
  altText: string | null;
  url: string;
  width: number | null;
  height: number | null;
  folder: string | null;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
};

export async function getMediaAssetList(
  siteId: string
): Promise<MediaAssetListItem[]> {
  const rows = await prisma.websiteMediaAsset.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      altText: true,
      url: true,
      width: true,
      height: true,
      folder: true,
      tags: true,
      isPublic: true,
      createdAt: true,
    },
  });
  return rows as MediaAssetListItem[];
}

export async function getMediaAssetDetail(
  assetId: string,
  siteId: string
): Promise<MediaAssetListItem | null> {
  const row = await prisma.websiteMediaAsset.findFirst({
    where: { id: assetId, siteId },
    select: {
      id: true,
      type: true,
      title: true,
      altText: true,
      url: true,
      width: true,
      height: true,
      folder: true,
      tags: true,
      isPublic: true,
      createdAt: true,
    },
  });
  return row as MediaAssetListItem | null;
}
