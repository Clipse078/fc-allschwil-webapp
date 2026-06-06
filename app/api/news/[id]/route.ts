/**
 * /api/news/[id] — News article detail and update.
 *
 * GET   /api/news/[id]   — get article detail (admin)
 * PATCH /api/news/[id]   — update article fields
 *
 * Requires NEWS_MANAGE permission. Tenant-scoped from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  getAdminNewsArticleById,
  updateNewsArticle,
  isSlugAvailable,
} from "@/lib/news/admin-queries";

const REQUIRED = [PERMISSIONS.NEWS_MANAGE];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    const article = await getAdminNewsArticleById(id, tenant.id);
    if (!article) return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });

    return NextResponse.json({ article });
  } catch (error) {
    console.error("[GET /api/news/[id]]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { title, slug, excerpt, content, heroMediaId, imageUrl, authorName, channels } = body;

    if (slug !== undefined) {
      if (typeof slug !== "string" || !slug.trim()) {
        return NextResponse.json({ error: "slug muss ein nicht-leerer String sein." }, { status: 400 });
      }
      if (!(await isSlugAvailable(tenant.id, slug.trim(), id))) {
        return NextResponse.json(
          { error: `Slug "${slug.trim()}" ist bereits vergeben.` },
          { status: 409 },
        );
      }
    }

    const updated = await updateNewsArticle(id, tenant.id, {
      ...(title !== undefined ? { title: String(title).trim() } : {}),
      ...(slug !== undefined ? { slug: String(slug).trim() } : {}),
      ...(excerpt !== undefined ? { excerpt: excerpt === null ? null : String(excerpt).trim() || null } : {}),
      ...(content !== undefined ? { content: String(content).trim() } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl === null ? null : String(imageUrl).trim() || null } : {}),
      ...(heroMediaId !== undefined ? { heroMediaId: heroMediaId === null ? null : String(heroMediaId) } : {}),
      ...(authorName !== undefined ? { authorName: authorName === null ? null : String(authorName).trim() || null } : {}),
      ...(channels !== undefined ? { channels: Array.isArray(channels) ? (channels as string[]) : null } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ article: updated });
  } catch (error) {
    console.error("[PATCH /api/news/[id]]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
