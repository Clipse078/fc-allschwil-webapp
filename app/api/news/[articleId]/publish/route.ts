/**
 * POST /api/news/[articleId]/publish
 *
 * Sets status=PUBLISHED, sets publishedAt on first publish.
 *
 * Permission: NEWS_MANAGE
 * Tenant isolation: strict (session.user.tenantId required)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { publishNewsArticle } from "@/lib/news/admin-queries";

type Params = { params: Promise<{ articleId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
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
  const article = await publishNewsArticle(articleId, tenantId);
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}
