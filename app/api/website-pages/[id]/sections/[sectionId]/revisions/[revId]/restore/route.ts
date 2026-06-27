/**
 * POST /api/website-pages/[id]/sections/[sectionId]/revisions/[revId]/restore
 *
 * Restores a page section to the state captured in a specific revision.
 *
 * Restoring creates a NEW revision (the restored state becomes the latest version).
 * History is never overwritten or deleted.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPageForTenant, updatePageSection } from "@/lib/page-sections/admin-queries";
import { getRevisionById } from "@/lib/cms/revision-engine";

type RouteParams = { params: Promise<{ id: string; sectionId: string; revId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id ?? null;
  const { id: pageId, sectionId, revId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const revision = await getRevisionById(tenantId, revId);
  if (!revision || revision.entityId !== sectionId || revision.entityType !== "WebsitePageSection") {
    return NextResponse.json({ error: "Version nicht gefunden." }, { status: 404 });
  }

  const snapshot = revision.snapshot;

  const { label, config } = snapshot as { label?: string; config?: Record<string, unknown> };

  const updated = await updatePageSection(tenantId, pageId, sectionId, {
    label: typeof label === "string" ? label : undefined,
    config: config && typeof config === "object" ? (config as Record<string, unknown>) : undefined,
    actorUserId,
    changeNote: `Wiederhergestellt aus Version ${revision.versionNumber}`,
  });

  if (!updated) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ section: updated, restoredFromVersion: revision.versionNumber });
}
