/**
 * PATCH /api/reusable-components/[id]/publish   — publish component
 * PATCH /api/reusable-components/[id]/unpublish — unpublish component
 *
 * Publish requires approvalStatus ∈ {NOT_REQUIRED, APPROVED}.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  publishReusableComponent,
  unpublishReusableComponent,
} from "@/lib/reusable-components/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;
  const { id } = await params;

  const url = new URL(request.url);
  const action = url.pathname.endsWith("/unpublish") ? "unpublish" : "publish";

  const component =
    action === "publish"
      ? await publishReusableComponent(tenantId, id, actorUserId)
      : await unpublishReusableComponent(tenantId, id, actorUserId);

  if (!component) {
    return NextResponse.json(
      {
        error:
          action === "publish"
            ? "Komponente nicht gefunden, nicht genehmigt oder kein Zugriff."
            : "Komponente nicht gefunden oder kein Zugriff.",
      },
      { status: action === "publish" ? 422 : 404 },
    );
  }

  return NextResponse.json({ component });
}
