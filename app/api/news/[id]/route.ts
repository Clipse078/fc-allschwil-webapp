/**
 * GET    /api/news/[id]  — fetch one article (admin, any status).
 * PATCH  /api/news/[id]  — update article fields.
 * DELETE /api/news/[id]  — hard-delete the article.
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNewsArticleAdminById,
  updateNewsArticle,
  deleteNewsArticle,
  isSlugAvailable,
} from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/news/[id] ────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const article = await getNewsArticleAdminById(tenantId, id);
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}

// ── PATCH /api/news/[id] ──────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // Slug collision check (only if slug is being changed)
  if (typeof body.slug === "string" && body.slug.trim()) {
    const slugOk = await isSlugAvailable(tenantId, body.slug.trim(), id);
    if (!slugOk) {
      return NextResponse.json({ error: "Slug wird bereits verwendet." }, { status: 409 });
    }
  }

  const updated = await updateNewsArticle(tenantId, id, {
    ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof body.slug === "string" ? { slug: body.slug.trim() } : {}),
    ...(body.excerpt !== undefined
      ? { excerpt: typeof body.excerpt === "string" ? body.excerpt.trim() || null : null }
      : {}),
    ...(typeof body.content === "string" ? { content: body.content } : {}),
    ...(body.imageUrl !== undefined
      ? { imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null }
      : {}),
    ...(body.heroMediaId !== undefined
      ? { heroMediaId: typeof body.heroMediaId === "string" ? body.heroMediaId : null }
      : {}),
    ...(body.channels !== undefined
      ? { channels: Array.isArray(body.channels) ? (body.channels as string[]) : null }
      : {}),
    ...(body.scheduledAt !== undefined
      ? {
          scheduledAt:
            typeof body.scheduledAt === "string" && body.scheduledAt
              ? new Date(body.scheduledAt)
              : null,
        }
      : {}),
    ...(body.authorName !== undefined
      ? {
          authorName:
            typeof body.authorName === "string" ? body.authorName.trim() || null : null,
        }
      : {}),
    ...(body.authorPersonId !== undefined
      ? {
          authorPersonId:
            typeof body.authorPersonId === "string" ? body.authorPersonId || null : null,
        }
      : {}),
    ...(body.tags !== undefined
      ? { tags: Array.isArray(body.tags) ? (body.tags as string[]) : null }
      : {}),
    ...(body.reviewNotes !== undefined
      ? {
          reviewNotes:
            typeof body.reviewNotes === "string" ? body.reviewNotes.trim() || null : null,
        }
      : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article: updated });
}

// ── DELETE /api/news/[id] ─────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteNewsArticle(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
