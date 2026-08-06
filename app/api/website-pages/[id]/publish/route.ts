/**
 * POST /api/website-pages/[id]/publish               — publish (or schedule) a page.
 * POST /api/website-pages/[id]/publish?action=unpublish   — revert to DRAFT.
 * POST /api/website-pages/[id]/publish?action=submit      — submit for review.
 * POST /api/website-pages/[id]/publish?action=approve     — reviewer approves.
 * POST /api/website-pages/[id]/publish?action=reject      — reviewer rejects (body: { notes }).
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishWebsitePage,
  unpublishWebsitePage,
  archiveWebsitePage,
  submitWebsitePageForReview,
  approveWebsitePage,
  rejectWebsitePage,
} from "@/lib/pages/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
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
    // body is optional
  }

  let page;

  switch (action) {
    case "unpublish":
      page = await unpublishWebsitePage(tenantId, id);
      break;
    case "archive": {
      const ok = await archiveWebsitePage(tenantId, id);
      if (!ok) {
        return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
      }
      return NextResponse.json({ archived: true });
    }
    case "submit":
      page = await submitWebsitePageForReview(tenantId, id);
      if (!page) {
        return NextResponse.json(
          { error: "Seite nicht gefunden oder Status nicht erlaubt." },
          { status: 404 },
        );
      }
      break;
    case "approve":
      page = await approveWebsitePage(tenantId, id);
      if (!page) {
        return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
      }
      break;
    case "reject": {
      const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      page = await rejectWebsitePage(tenantId, id, notes);
      if (!page) {
        return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
      }
      break;
    }
    default:
      page = await publishWebsitePage(tenantId, id);
  }

  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ page });
}
