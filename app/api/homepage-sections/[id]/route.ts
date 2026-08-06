/**
 * DELETE /api/homepage-sections/[id]
 *
 * Permanently deletes a homepage section (hard delete).
 *
 * Safety: section ownership is verified in the query layer (tenant-scoped).
 * Published sections can be deleted — the UI requires confirmation before
 * calling this endpoint.
 *
 * Audit trail: written to AuditLog (best-effort, never throws).
 * Matches the same audit pattern as requestReview, approve, and reject.
 *
 * Returns: { sections, meta: { total } } — full updated list + count.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             actorUserId from session — used for audit trail only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { deleteHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;
  if (!actorUserId) {
    return NextResponse.json({ error: "Benutzer-ID fehlt in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const sections = await deleteHomepageSection(tenantId, id, actorUserId);
  if (sections === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ sections, meta: { total: sections.length } });
}
