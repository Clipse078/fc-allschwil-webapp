"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";

async function requireNews() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.permissionKeys ?? []).includes(PERMISSIONS.NEWS_MANAGE)) {
    redirect("/dashboard");
  }
  return session;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

export async function createNewsArticleAction(formData: FormData) {
  await requireNews();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/news?status=no-site");

  const title = str(formData, "title");
  const rawSlug = str(formData, "slug");
  const slug = slugify(rawSlug || title);
  const locale = str(formData, "locale") || site.locale;

  if (!title || !slug) {
    redirect("/dashboard/website/news/new?status=missing-fields");
  }

  const conflict = await prisma.newsArticle.findUnique({
    where: { siteId_slug_locale: { siteId: site.id, slug, locale } },
    select: { id: true },
  });
  if (conflict) redirect("/dashboard/website/news/new?status=slug-exists");

  const article = await prisma.newsArticle.create({
    data: {
      siteId: site.id,
      slug,
      locale,
      title,
      listingText: nullable(formData, "listingText"),
      body: nullable(formData, "body"),
      coverImageUrl: nullable(formData, "coverImageUrl"),
      authorName: nullable(formData, "authorName"),
      status: "DRAFT",
    },
  });

  revalidatePath("/dashboard/website/news");
  redirect(`/dashboard/website/news/${article.id}?status=created`);
}

export async function updateNewsArticleAction(formData: FormData) {
  await requireNews();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/news?status=no-site");

  const articleId = str(formData, "articleId");
  if (!articleId) redirect("/dashboard/website/news?status=missing-id");

  const existing = await prisma.newsArticle.findFirst({
    where: { id: articleId, siteId: site.id },
    select: { id: true, slug: true, locale: true },
  });
  if (!existing) redirect("/dashboard/website/news?status=not-found");

  const title = str(formData, "title");
  if (!title) redirect(`/dashboard/website/news/${articleId}?status=missing-fields`);

  const rawSlug = str(formData, "slug");
  const slug = slugify(rawSlug || existing.slug);
  const locale = str(formData, "locale") || existing.locale;

  if (slug !== existing.slug || locale !== existing.locale) {
    const conflict = await prisma.newsArticle.findUnique({
      where: { siteId_slug_locale: { siteId: site.id, slug, locale } },
      select: { id: true },
    });
    if (conflict && conflict.id !== articleId) {
      redirect(`/dashboard/website/news/${articleId}?status=slug-exists`);
    }
  }

  await prisma.newsArticle.update({
    where: { id: articleId },
    data: {
      title,
      slug,
      locale,
      listingText: nullable(formData, "listingText"),
      body: nullable(formData, "body"),
      coverImageUrl: nullable(formData, "coverImageUrl"),
      authorName: nullable(formData, "authorName"),
    },
  });

  revalidatePath("/dashboard/website/news");
  revalidatePath(`/dashboard/website/news/${articleId}`);
  redirect(`/dashboard/website/news/${articleId}?status=saved`);
}

export async function publishNewsArticleAction(formData: FormData) {
  await requireNews();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/news?status=no-site");

  const articleId = str(formData, "articleId");
  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, siteId: site.id },
    select: { id: true, publishedAt: true },
  });
  if (!article) redirect("/dashboard/website/news?status=not-found");

  await prisma.newsArticle.update({
    where: { id: articleId },
    data: {
      status: "PUBLISHED",
      publishedAt: article.publishedAt ?? new Date(),
    },
  });

  revalidatePath("/dashboard/website/news");
  revalidatePath(`/dashboard/website/news/${articleId}`);
  redirect(`/dashboard/website/news/${articleId}?status=published`);
}

export async function archiveNewsArticleAction(formData: FormData) {
  await requireNews();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/news?status=no-site");

  const articleId = str(formData, "articleId");
  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, siteId: site.id },
    select: { id: true },
  });
  if (!article) redirect("/dashboard/website/news?status=not-found");

  await prisma.newsArticle.update({
    where: { id: articleId },
    data: { status: "DRAFT" },
  });

  revalidatePath("/dashboard/website/news");
  revalidatePath(`/dashboard/website/news/${articleId}`);
  redirect(`/dashboard/website/news/${articleId}?status=archived`);
}

export async function deleteNewsArticleAction(formData: FormData) {
  await requireNews();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/news?status=no-site");

  const articleId = str(formData, "articleId");
  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, siteId: site.id },
    select: { id: true },
  });
  if (!article) redirect("/dashboard/website/news?status=not-found");

  await prisma.newsArticle.delete({ where: { id: articleId } });

  revalidatePath("/dashboard/website/news");
  redirect("/dashboard/website/news?status=deleted");
}
