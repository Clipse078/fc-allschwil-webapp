"use server";

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

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateNewsArticle(formData: FormData): Promise<UpdateResult> {
  await requireAccess();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const listingText = String(formData.get("listingText") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;
  const locale = String(formData.get("locale") ?? "de").trim() || "de";

  if (!id || !title) return { ok: false, error: "Titel ist erforderlich." };

  const article = await prisma.newsArticle.findFirst({
    where: { id, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true, siteId: true, slug: true, locale: true },
  });
  if (!article) return { ok: false, error: "Artikel nicht gefunden." };

  const slug = slugRaw || slugify(title) || `article-${Date.now()}`;

  // Duplicate check
  if (slug !== article.slug || locale !== article.locale) {
    const dup = await prisma.newsArticle.findUnique({
      where: { siteId_slug_locale: { siteId: article.siteId, slug, locale } },
      select: { id: true },
    });
    if (dup && dup.id !== article.id) {
      return { ok: false, error: `Slug «${slug}» existiert bereits für ${locale.toUpperCase()}.` };
    }
  }

  await prisma.newsArticle.update({
    where: { id },
    data: { title, slug, excerpt, listingText, body, coverImageUrl, locale },
  });

  revalidatePath(`/dashboard/website/news/${id}`);
  revalidatePath("/dashboard/website/news");
  return { ok: true };
}

export async function setArticleStatus(formData: FormData): Promise<UpdateResult> {
  await requireAccess();

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const allowed = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"];
  if (!id || !allowed.includes(status)) return { ok: false, error: "Ungültiger Status." };

  const article = await prisma.newsArticle.findFirst({
    where: { id, site: { tenantKey: SITE_TENANT_KEY } },
    select: { id: true },
  });
  if (!article) return { ok: false, error: "Artikel nicht gefunden." };

  await prisma.newsArticle.update({
    where: { id },
    data: {
      status: status as "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED",
      publishedAt: status === "PUBLISHED" ? new Date() : undefined,
    },
  });

  revalidatePath(`/dashboard/website/news/${id}`);
  revalidatePath("/dashboard/website/news");
  return { ok: true };
}
