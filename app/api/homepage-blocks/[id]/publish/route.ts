/**
 * POST /api/homepage-blocks/[id]/publish               — publish (or schedule) a block.
 * POST /api/homepage-blocks/[id]/publish?action=unpublish   — revert to DRAFT.
 * POST /api/homepage-blocks/[id]/publish?action=submit      — submit for review.
 * POST /api/homepage-blocks/[id]/publish?action=approve     — reviewer approves.
 * POST /api/homepage-blocks/[id]/publish?action=reject      — reviewer rejects (body: { notes }).
 * POST /api/homepage-blocks/[id]/publish?action=archive     — archive block.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishHomepageBlock,
  unpublishHomepageBlock,
  archiveHomepageBlock,
  submitHomepageBlockForReview,
  approveHomepageBlock,
  rejectHomepageBlock,
} from "@/lib/homepage-blocks/admin-queries";

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
    // body is optional
  }

  let block;

  switch (action) {
    case "unpublish":
      block = await unpublishHomepageBlock(tenantId, id);
      break;
    case "archive": {
      const ok = await archiveHomepageBlock(tenantId, id);
      if (!ok) {
        return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      }
      return NextResponse.json({ archived: true });
    }
    case "submit":
      block = await submitHomepageBlockForReview(tenantId, id);
      if (!block) {
        return NextResponse.json(
          { error: "Block nicht gefunden oder Status nicht erlaubt." },
          { status: 404 },
        );
      }
      break;
    case "approve":
      block = await approveHomepageBlock(tenantId, id);
      if (!block) {
        return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      }
      break;
    case "reject": {
      const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
      block = await rejectHomepageBlock(tenantId, id, notes);
      if (!block) {
        return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
      }
      break;
    }
    default:
      block = await publishHomepageBlock(tenantId, id);
  }

  if (!block) {
    return NextResponse.json({ error: "Block nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ block });
}
