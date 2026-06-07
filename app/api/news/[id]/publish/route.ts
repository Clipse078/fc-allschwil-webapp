/**
 * POST /api/news/[id]/publish               — publish (or schedule) an article.
 * POST /api/news/[id]/publish?action=unpublish   — revert to DRAFT.
 * POST /api/news/[id]/publish?action=submit      — submit for review.
 * POST /api/news/[id]/publish?action=approve     — reviewer approves.
 * POST /api/news/[id]/publish?action=reject      — reviewer rejects (body: { notes }).
 *
 * Permission: NEWS_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishNewsArticle,
  unpublishNewsArticle,
  archiveNewsArticle,
  submitNewsArticleForReview,
  approveNewsArticle,
  rejectNewsArticle,
} from "@/lib/news/admin-queries";

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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // body is optional for most actions
  }

  let article;

  switch (action) {
    case "unpublish":
      article = await unpublishNewsArticle(tenantId, id);
      break;
    case "archive": {
      const ok = await archiveNewsArticle(tenantId, id);
      if (!ok) {
        return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
      }
      return NextResponse.json({ archived: true });
    }
    case "submit":
      article = await submitNewsArticleForReview(tenantId, id);
      if (!article) {
        return NextResponse.json(
          { error: "Artikel nicht gefunden oder Status nicht erlaubt." },
          { status: 404 },
        );
      }
      break;
    case "approve":
      article = await approveNewsArticle(tenantId, id);
      if (!article) {
        return NextResponse.json(
          { error: "Artikel nicht gefunden." },
          { status: 404 },
        );
      }
      break;
    case "reject": {
      const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      article = await rejectNewsArticle(tenantId, id, notes);
      if (!article) {
        return NextResponse.json(
          { error: "Artikel nicht gefunden." },
          { status: 404 },
        );
      }
      break;
    }
    default:
      article = await publishNewsArticle(tenantId, id);
  }

  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ article });
}
