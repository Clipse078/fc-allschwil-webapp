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
    redirect("/dashboard?error=access-denied");
  }
  return session;
}

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export async function createNewsArticle(formData: FormData) {
  const session = await requireAccess();
  const actorUserId = session.user.effectiveUserId ?? session.user.id ?? null;

  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "de").trim() || "de";

  if (!title) return;

  let site = await prisma.websiteSite.findUnique({ where: { tenantKey: SITE_TENANT_KEY }, select: { id: true } });
  if (!site) {
    site = await prisma.websiteSite.create({ data: { tenantKey: SITE_TENANT_KEY, name: SITE_TENANT_KEY }, select: { id: true } });
  }

  const slug = slugify(title) || `article-${Date.now()}`;
  const existing = await prisma.newsArticle.findUnique({
    where: { siteId_slug_locale: { siteId: site.id, slug, locale } },
    select: { id: true },
  });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  await prisma.newsArticle.create({
    data: { siteId: site.id, title, slug: finalSlug, excerpt, locale, authorId: actorUserId },
  });

  revalidatePath("/dashboard/website/news");
}

export async function publishNewsArticle(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.newsArticle.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  revalidatePath("/dashboard/website/news");
}

export async function archiveNewsArticle(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await prisma.newsArticle.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/dashboard/website/news");
}
