"use server";

import { Prisma, WebsitePageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getTemplateByKey,
  TEMPLATE_CATALOG,
} from "@/lib/website/template-catalog";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function requireWebsiteAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const keys = session.user.permissionKeys ?? [];
  if (!keys.includes(PERMISSIONS.WEBSITE_MANAGE)) {
    redirect("/dashboard/website?status=forbidden");
  }

  return session;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function createWebsitePage(formData: FormData) {
  const session = await requireWebsiteAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const templateKey = String(formData.get("templateKey") ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const locale = String(formData.get("locale") ?? "de").trim() || "de";

  if (!templateKey || !titleRaw) {
    redirect("/dashboard/website?status=create-missing-fields");
  }

  const template = getTemplateByKey(templateKey);
  if (!template) {
    redirect("/dashboard/website?status=create-invalid-template");
  }

  const validPageTypes = Object.values(WebsitePageType) as string[];
  if (!validPageTypes.includes(template.pageType)) {
    redirect("/dashboard/website?status=create-invalid-type");
  }

  const slug = slugRaw || slugify(titleRaw);
  if (!slug) {
    redirect("/dashboard/website?status=create-invalid-slug");
  }

  // Ensure site exists
  let site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: { id: true },
  });

  if (!site) {
    site = await prisma.websiteSite.create({
      data: { tenantKey: SITE_TENANT_KEY, name: SITE_TENANT_KEY },
      select: { id: true },
    });
  }

  // Duplicate slug+locale check
  const existing = await prisma.websitePage.findUnique({
    where: { siteId_slug_locale: { siteId: site.id, slug, locale } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/dashboard/website?status=create-duplicate-slug&slug=${encodeURIComponent(slug)}`);
  }

  // Determine sort order
  const maxOrder = await prisma.websitePage.aggregate({
    where: { siteId: site.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  // Build block JSON from template suggested blocks
  const blocksJson = template.suggestedBlocks.map((b, i) => ({
    id: `block-${i + 1}`,
    type: b.type,
    props: b.props ?? {},
    sortOrder: i + 1,
  }));

  // Create page + first version in a transaction
  const page = await prisma.$transaction(async (tx) => {
    const newPage = await tx.websitePage.create({
      data: {
        siteId: site.id,
        slug,
        title: titleRaw,
        pageType: template.pageType as WebsitePageType,
        templateKey,
        locale,
        status: "DRAFT",
        sortOrder,
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });

    await tx.websitePageVersion.create({
      data: {
        pageId: newPage.id,
        version: 1,
        blocksJson: blocksJson as Prisma.InputJsonValue,
        changeNote: `Erste Version aus Vorlage «${template.label}»`,
        createdByUserId: actorUserId,
      },
    });

    return newPage;
  });

  revalidatePath("/dashboard/website");
  redirect(`/dashboard/website?created=${page.id}`);
}

