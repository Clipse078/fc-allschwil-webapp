/**
 * PATCH /api/homepage-sections/[id]/unpublish
 *
 * Unpublishes a homepage section by setting publishStatus = "DRAFT".
 * Records unpublishedAt timestamp.
 * Retains lastPublishedAt for audit trail.
 * Clears any pending scheduledPublishAt.
 *
 * Unpublished sections are excluded from the public homepage API,
 * regardless of their isEnabled state.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             Section ownership verified via tenant-scoped lookup.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { unpublishHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const updated = await unpublishHomepageSection(tenantId, id);
  if (!updated) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ section: updated });
}
