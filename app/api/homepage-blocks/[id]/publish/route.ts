/**
 * POST /api/homepage-blocks/[id]/publish               — publish block.
 * POST /api/homepage-blocks/[id]/publish?action=unpublish  — revert to DRAFT.
 * POST /api/homepage-blocks/[id]/publish?action=submit     — submit for review.
 * POST /api/homepage-blocks/[id]/publish?action=approve    — reviewer approves.
 * POST /api/homepage-blocks/[id]/publish?action=reject     — reject (body: { notes }).
 * POST /api/homepage-blocks/[id]/publish?action=archive    — archive.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishHomepageBlock,
  unpublishHomepageBlock,
  submitHomepageBlockForReview,
  approveHomepageBlock,
  rejectHomepageBlock,
  archiveHomepageBlock,
} from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
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
    // body optional
  }

  switch (action) {
    case "unpublish": {
      const block = await unpublishHomepageBlock(tenantId, id);
      if (!block) return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      return NextResponse.json({ block });
    }
    case "submit": {
      const block = await submitHomepageBlockForReview(tenantId, id);
      if (!block)
        return NextResponse.json(
          { error: "Block nicht gefunden oder Status nicht erlaubt." },
          { status: 404 },
        );
      return NextResponse.json({ block });
    }
    case "approve": {
      const block = await approveHomepageBlock(tenantId, id);
      if (!block) return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      return NextResponse.json({ block });
    }
    case "reject": {
      const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      const block = await rejectHomepageBlock(tenantId, id, notes);
      if (!block) return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      return NextResponse.json({ block });
    }
    case "archive": {
      const ok = await archiveHomepageBlock(tenantId, id);
      if (!ok) return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      return NextResponse.json({ archived: true });
    }
    default: {
      const block = await publishHomepageBlock(tenantId, id);
      if (!block) return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      return NextResponse.json({ block });
    }
  }
}
