"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function requireAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!(session.user.permissionKeys ?? []).includes(PERMISSIONS.WEBSITE_MANAGE)) {
    redirect("/dashboard/website?status=forbidden");
  }

  return session;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; error: string };

export async function saveBlockVersion(formData: FormData): Promise<SaveResult> {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const pageId = String(formData.get("pageId") ?? "").trim();
  const blocksRaw = String(formData.get("blocksJson") ?? "").trim();
  const changeNote = String(formData.get("changeNote") ?? "").trim() || null;

  if (!pageId || !blocksRaw) return { ok: false, error: "Fehlende Pflichtfelder." };

  let blocksJson: unknown;
  try {
    blocksJson = JSON.parse(blocksRaw);
  } catch {
    return { ok: false, error: "Ungültiges Block-Format." };
  }

  if (!Array.isArray(blocksJson)) {
    return { ok: false, error: "Ungültiges Block-Format." };
  }

  // Verify page belongs to this tenant
  const page = await prisma.websitePage.findFirst({
    where: { id: pageId, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, status: true },
  });

  if (!page) return { ok: false, error: "Seite nicht gefunden." };
  if (page.status === "ARCHIVED") {
    return { ok: false, error: "Archivierte Seiten können nicht bearbeitet werden." };
  }

  // Next version number
  const maxVer = await prisma.websitePageVersion.aggregate({
    where: { pageId },
    _max: { version: true },
  });
  const nextVersion = (maxVer._max.version ?? 0) + 1;

  await prisma.websitePageVersion.create({
    data: {
      pageId,
      version: nextVersion,
      blocksJson: blocksJson as Prisma.InputJsonValue,
      changeNote,
      createdByUserId: actorUserId,
    },
  });

  revalidatePath(`/dashboard/website/pages/${pageId}`);
  revalidatePath("/dashboard/website");

  return { ok: true, version: nextVersion };
}
