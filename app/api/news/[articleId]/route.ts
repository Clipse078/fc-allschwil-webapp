/**
 * /api/news/[articleId] — Admin news article detail, update, and delete.
 *
 * GET    → fetch single article (all fields including content)
 * PATCH  → update article fields (title, slug, excerpt, content, imageUrl)
 * DELETE → hard delete article
 *
 * Permission: NEWS_MANAGE
 * Tenant isolation: tenantId from session (strict). All operations verify
 *   that the article belongs to the session's tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNewsArticleById,
  updateNewsArticle,
  deleteNewsArticle,
  isSlugAvailable,
  slugify,
} from "@/lib/news/admin-queries";

type Params = { params: Promise<{ articleId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const { articleId } = await params;
  const article = await getNewsArticleById(articleId, tenantId);
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const { articleId } = await params;

  const existing = await getNewsArticleById(articleId, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Request body required." }, { status: 400 });
  }

  const data: Parameters<typeof updateNewsArticle>[2] = {};

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }

  if (typeof body.slug === "string") {
    const newSlug = slugify(body.slug.trim());
    if (!newSlug) {
      return NextResponse.json({ error: "Ungültiger Slug." }, { status: 400 });
    }
    const available = await isSlugAvailable(newSlug, tenantId, articleId);
    if (!available) {
      return NextResponse.json(
        { error: `Slug "${newSlug}" ist bereits vergeben.` },
        { status: 409 },
      );
    }
    data.slug = newSlug;
  }

  if ("excerpt" in body) {
    data.excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() || null : null;
  }

  if (typeof body.content === "string") {
    data.content = body.content;
  }

  if ("imageUrl" in body) {
    data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine gültigen Felder zum Aktualisieren." }, { status: 400 });
  }

  const article = await updateNewsArticle(articleId, tenantId, data);
  return NextResponse.json({ article });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const { articleId } = await params;
  const result = await deleteNewsArticle(articleId, tenantId);
  if (!result) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
