"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";

async function requireWebsite() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const keys = session.user.permissionKeys ?? [];
  if (
    !keys.includes(PERMISSIONS.NEWS_MANAGE) &&
    !keys.includes(PERMISSIONS.WEBSITE_MANAGE)
  ) {
    redirect("/dashboard");
  }
  return session;
}

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

function intOrNull(fd: FormData, key: string): number | null {
  const v = parseInt(str(fd, key), 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function createMediaAssetAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/media?status=no-site");

  const url = str(formData, "url");
  const title = str(formData, "title") || url.split("/").pop() || "Asset";
  const type = (str(formData, "type") || "IMAGE") as
    | "IMAGE"
    | "VIDEO"
    | "PDF"
    | "OTHER";

  if (!url) redirect("/dashboard/website/media?status=missing-url");

  await prisma.websiteMediaAsset.create({
    data: {
      siteId: site.id,
      url,
      title,
      type,
      altText: nullable(formData, "altText"),
      folder: nullable(formData, "folder"),
      tags: parseTags(str(formData, "tags")),
      width: intOrNull(formData, "width"),
      height: intOrNull(formData, "height"),
      isPublic: true,
    },
  });

  revalidatePath("/dashboard/website/media");
  redirect("/dashboard/website/media?status=added");
}

export async function deleteMediaAssetAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/media?status=no-site");

  const assetId = str(formData, "assetId");
  const asset = await prisma.websiteMediaAsset.findFirst({
    where: { id: assetId, siteId: site.id },
    select: { id: true },
  });
  if (!asset) redirect("/dashboard/website/media?status=not-found");

  await prisma.websiteMediaAsset.delete({ where: { id: assetId } });

  revalidatePath("/dashboard/website/media");
  redirect("/dashboard/website/media?status=deleted");
}
