/**
 * GET    /api/news/[articleId] — get article detail
 * PATCH  /api/news/[articleId] — update article
 * DELETE /api/news/[articleId] — delete article (hard delete)
 *
 * Permission: news.manage (read/write)
 * Publish/unpublish additionally requires news.publish.
 * Tenant isolation: session.user.tenantId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  getNewsArticleById,
  updateNewsArticle,
  deleteNewsArticle,
  isSlugAvailable,
} from "@/lib/news/admin-news-queries";
import type { NewsArticleStatus } from "@prisma/client";

const VALID_STATUSES: NewsArticleStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];

function isValidStatus(s: unknown): s is NewsArticleStatus {
  return typeof s === "string" && (VALID_STATUSES as string[]).includes(s);
}

type RouteContext = { params: Promise<{ articleId: string }> };

// ---------------------------------------------------------------------------
// GET /api/news/[articleId]
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });

  const { articleId } = await params;
  const article = await getNewsArticleById(tenant.id, articleId);
  if (!article) return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });

  return NextResponse.json({ article });
}

// ---------------------------------------------------------------------------
// PATCH /api/news/[articleId]
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });

  const { articleId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Leerer Body." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  // Publish/unpublish requires news.publish
  const wantsPublish =
    isValidStatus(data.status) &&
    (data.status === "PUBLISHED" || data.status === "APPROVED");
  if (wantsPublish && !hasPermission(access.session, PERMISSIONS.NEWS_PUBLISH)) {
    return NextResponse.json(
      { error: "Fehlende Berechtigung zum Veröffentlichen von Artikeln (news.publish)." },
      { status: 403 },
    );
  }

  // Slug uniqueness check when changing slug
  if (typeof data.slug === "string") {
    const slug = data.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten." },
        { status: 400 },
      );
    }
    const available = await isSlugAvailable(tenant.id, slug, articleId);
    if (!available) {
      return NextResponse.json({ error: "Dieser Slug ist bereits vergeben." }, { status: 409 });
    }
  }

  // Auto-set publishedAt when publishing for the first time
  let publishedAt: Date | null | undefined = undefined;
  if (isValidStatus(data.status) && data.status === "PUBLISHED") {
    const existing = await getNewsArticleById(tenant.id, articleId);
    if (!existing) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }
    if (!existing.publishedAt) {
      publishedAt =
        typeof data.publishedAt === "string" && data.publishedAt
          ? new Date(data.publishedAt)
          : new Date();
    } else {
      publishedAt = existing.publishedAt;
    }
  } else if (data.publishedAt === null) {
    publishedAt = null;
  } else if (typeof data.publishedAt === "string" && data.publishedAt) {
    publishedAt = new Date(data.publishedAt);
  }

  const update: Record<string, unknown> = {};
  if (typeof data.slug === "string") update.slug = data.slug.trim();
  if (typeof data.title === "string") update.title = data.title.trim();
  if ("excerpt" in data) update.excerpt = typeof data.excerpt === "string" ? data.excerpt.trim() || null : null;
  if (typeof data.content === "string") update.content = data.content;
  if ("imageUrl" in data) update.imageUrl = typeof data.imageUrl === "string" ? data.imageUrl.trim() || null : null;
  if ("authorName" in data) update.authorName = typeof data.authorName === "string" ? data.authorName.trim() || null : null;
  if (isValidStatus(data.status)) update.status = data.status;
  if (publishedAt !== undefined) update.publishedAt = publishedAt;

  const article = await updateNewsArticle(tenant.id, articleId, update as Parameters<typeof updateNewsArticle>[2]);
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}

// ---------------------------------------------------------------------------
// DELETE /api/news/[articleId]
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });

  const { articleId } = await params;
  const deleted = await deleteNewsArticle(tenant.id, articleId);
  if (!deleted) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
