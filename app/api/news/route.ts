/**
 * POST /api/news — create a news article draft
 * GET  /api/news — list news articles (all statuses, tenant-scoped)
 *
 * Permission: news.manage
 * Tenant isolation: from session.user.tenantId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { listNewsArticles, createNewsArticle, isSlugAvailable } from "@/lib/news/admin-news-queries";
import type { NewsArticleStatus } from "@prisma/client";

const VALID_STATUSES: NewsArticleStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];

function isValidStatus(s: unknown): s is NewsArticleStatus {
  return typeof s === "string" && (VALID_STATUSES as string[]).includes(s);
}

// ---------------------------------------------------------------------------
// GET /api/news
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  const status = rawStatus && isValidStatus(rawStatus) ? rawStatus : null;

  const articles = await listNewsArticles({ tenantId: tenant.id, status });
  return NextResponse.json({ articles });
}

// ---------------------------------------------------------------------------
// POST /api/news
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Leerer oder ungültiger Body." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const content = typeof data.content === "string" ? data.content : "";

  if (!title) return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug ist erforderlich." }, { status: 400 });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten." },
      { status: 400 },
    );
  }

  const slugFree = await isSlugAvailable(tenant.id, slug);
  if (!slugFree) {
    return NextResponse.json({ error: "Dieser Slug ist bereits vergeben." }, { status: 409 });
  }

  const status: NewsArticleStatus =
    isValidStatus(data.status) ? data.status : "DRAFT";

  let publishedAt: Date | null = null;
  if (status === "PUBLISHED") {
    publishedAt =
      typeof data.publishedAt === "string" && data.publishedAt
        ? new Date(data.publishedAt)
        : new Date();
  } else if (typeof data.publishedAt === "string" && data.publishedAt) {
    publishedAt = new Date(data.publishedAt);
  }

  const article = await createNewsArticle({
    tenantId: tenant.id,
    slug,
    title,
    excerpt: typeof data.excerpt === "string" ? data.excerpt.trim() || null : null,
    content,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl.trim() || null : null,
    authorName: typeof data.authorName === "string" ? data.authorName.trim() || null : null,
    status,
    publishedAt,
  });

  return NextResponse.json({ article }, { status: 201 });
}
