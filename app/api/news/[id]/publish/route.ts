/**
 * POST /api/news/[id]/publish   — publish a news article.
 * POST /api/news/[id]/publish?action=unpublish — revert to DRAFT.
 *
 * Permission: NEWS_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { publishNewsArticle, unpublishNewsArticle } from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const article =
    action === "unpublish"
      ? await unpublishNewsArticle(tenantId, id)
      : await publishNewsArticle(tenantId, id);

  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}
