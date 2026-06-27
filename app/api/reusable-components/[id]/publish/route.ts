/**
 * PATCH /api/reusable-components/[id]/publish
 *
 * Publishes a reusable component.
 * Requires approvalStatus ∈ {NOT_REQUIRED, APPROVED}.
 *
 * Unpublish is handled by the separate /unpublish route.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { publishReusableComponent } from "@/lib/reusable-components/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
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

  const component = await publishReusableComponent(tenantId, id, actorUserId);

  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden, nicht genehmigt oder kein Zugriff." },
      { status: 422 },
    );
  }

  return NextResponse.json({ component });
}
