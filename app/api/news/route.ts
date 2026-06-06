/**
 * /api/news — News article list and create.
 *
 * GET  /api/news?status=DRAFT   — list admin articles (all statuses)
 * POST /api/news                — create new article
 *
 * Requires NEWS_MANAGE permission. Tenant-scoped from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  listAdminNewsArticles,
  createNewsArticle,
  isSlugAvailable,
  titleToSlug,
} from "@/lib/news/admin-queries";
import type { NewsArticleStatus } from "@prisma/client";

const REQUIRED = [PERMISSIONS.NEWS_MANAGE];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    const validStatuses: NewsArticleStatus[] = ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];
    const status = rawStatus && validStatuses.includes(rawStatus as NewsArticleStatus)
      ? (rawStatus as NewsArticleStatus)
      : null;

    const { articles, total } = await listAdminNewsArticles({
      tenantId: tenant.id,
      status,
      limit,
      offset,
    });

    return NextResponse.json({ articles, total, limit, offset });
  } catch (error) {
    console.error("[GET /api/news]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const { title, slug: rawSlug, excerpt, content, heroMediaId, imageUrl, authorName, channels } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title ist erforderlich." }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content ist erforderlich." }, { status: 400 });
    }

    const slug = typeof rawSlug === "string" && rawSlug.trim()
      ? rawSlug.trim()
      : titleToSlug(title);

    if (!(await isSlugAvailable(tenant.id, slug))) {
      return NextResponse.json(
        { error: `Slug "${slug}" ist bereits vergeben. Bitte einen anderen wählen.` },
        { status: 409 },
      );
    }

    const article = await createNewsArticle({
      tenantId: tenant.id,
      slug,
      title: String(title).trim(),
      excerpt: typeof excerpt === "string" ? excerpt.trim() || null : null,
      content: String(content).trim(),
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() || null : null,
      heroMediaId: typeof heroMediaId === "string" ? heroMediaId : null,
      authorName: typeof authorName === "string" ? authorName.trim() || null : null,
      channels: Array.isArray(channels) ? (channels as string[]) : null,
      createdById: session.user.id ?? null,
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/news]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
