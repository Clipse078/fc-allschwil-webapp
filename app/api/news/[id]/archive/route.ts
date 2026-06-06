/**
 * /api/news/[id]/archive — Archive a news article.
 *
 * POST /api/news/[id]/archive   — set status=ARCHIVED
 *
 * Requires NEWS_MANAGE permission. Tenant-scoped from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { archiveNewsArticle } from "@/lib/news/admin-queries";

const REQUIRED = [PERMISSIONS.NEWS_MANAGE];

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!hasAnyPermission(session, REQUIRED)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const tenant = await getTenantFromSession(session.user.tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

    const article = await archiveNewsArticle(id, tenant.id);
    if (!article) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error("[POST /api/news/[id]/archive]", error);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
