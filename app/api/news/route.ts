/**
 * GET  /api/news  — list news articles (admin, all statuses).
 * POST /api/news  — create a new draft article.
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listNewsArticlesAdmin,
  countNewsArticlesAdmin,
  createNewsArticle,
  isSlugAvailable,
  slugify,
  type ArticleStatus,
} from "@/lib/news/admin-queries";

const VALID_STATUSES: ArticleStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

// ── GET /api/news ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status")?.toUpperCase();
  const status = VALID_STATUSES.includes(rawStatus as ArticleStatus)
    ? (rawStatus as ArticleStatus)
    : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const [articles, total] = await Promise.all([
    listNewsArticlesAdmin({ tenantId, status, limit, offset }),
    countNewsArticlesAdmin(tenantId, status),
  ]);

  return NextResponse.json({ articles, meta: { total, limit, offset } });
}

// ── POST /api/news ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";

  let slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) slug = slugify(title);

  let finalSlug = slug;
  let counter = 1;
  while (!(await isSlugAvailable(tenantId, finalSlug))) {
    finalSlug = `${slug}-${counter++}`;
  }

  const article = await createNewsArticle({
    tenantId,
    slug: finalSlug,
    title,
    content,
    excerpt: typeof body.excerpt === "string" ? body.excerpt.trim() || null : null,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
    heroMediaId: typeof body.heroMediaId === "string" ? body.heroMediaId : null,
    channels: Array.isArray(body.channels) ? (body.channels as string[]) : null,
    scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null,
    authorName: typeof body.authorName === "string" ? body.authorName.trim() || null : null,
    authorPersonId: typeof body.authorPersonId === "string" ? body.authorPersonId : null,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : null,
  });

  return NextResponse.json({ article }, { status: 201 });
}
