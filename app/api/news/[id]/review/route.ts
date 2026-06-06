/**
 * POST /api/news/[id]/review  — editorial review workflow actions.
 *
 * Body: { action: "submit" | "approve" | "reject", reviewNotes?: string }
 *
 * - submit:  reviewStage DRAFT → SUBMITTED (any NEWS_MANAGE user)
 * - approve: reviewStage SUBMITTED → APPROVED (NEWS_MANAGE user)
 * - reject:  reviewStage SUBMITTED → REJECTED + reviewNotes (NEWS_MANAGE user)
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  submitNewsArticleForReview,
  approveNewsArticle,
  rejectNewsArticle,
} from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id } = await params;

  let body: { action?: string; reviewNotes?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const { action, reviewNotes } = body;

  let article;
  if (action === "submit") {
    article = await submitNewsArticleForReview(tenantId, id);
  } else if (action === "approve") {
    article = await approveNewsArticle(tenantId, id, reviewNotes);
  } else if (action === "reject") {
    article = await rejectNewsArticle(tenantId, id, reviewNotes);
  } else {
    return NextResponse.json(
      { error: "Ungültige Aktion. Erlaubt: submit, approve, reject." },
      { status: 422 },
    );
  }

  if (!article) return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });

  return NextResponse.json({ article });
}
