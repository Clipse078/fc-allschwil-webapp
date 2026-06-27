/**
 * POST /api/reusable-components/[id]/revisions/[revId]/restore
 *
 * Restores a component to a previous revision state.
 * Creates a new revision (isRestore=true) — never overwrites history.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getReusableComponent, updateReusableComponent } from "@/lib/reusable-components/queries";
import { getRevisionById, captureRevision } from "@/lib/cms/revision-engine";
import { logAction } from "@/lib/audit/log-action";

type RouteParams = { params: Promise<{ id: string; revId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id;
  const { id, revId } = await params;

  // Verify component ownership
  const component = await getReusableComponent(tenantId, id);
  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  // Load source revision
  const revision = await getRevisionById(tenantId, revId);
  if (!revision || revision.entityType !== "ReusableComponent" || revision.entityId !== id) {
    return NextResponse.json(
      { error: "Revision nicht gefunden oder gehört nicht zu dieser Komponente." },
      { status: 404 },
    );
  }

  const snap = revision.snapshot;

  // Restore fields from snapshot
  const updated = await updateReusableComponent(
    tenantId,
    id,
    {
      title: typeof snap.title === "string" ? snap.title : undefined,
      description: typeof snap.description === "string" ? snap.description : undefined,
      config:
        snap.config !== null && typeof snap.config === "object" && !Array.isArray(snap.config)
          ? (snap.config as Record<string, unknown>)
          : undefined,
    },
    actorUserId,
  );

  if (!updated) {
    return NextResponse.json(
      { error: "Wiederherstellung fehlgeschlagen." },
      { status: 500 },
    );
  }

  // Create restore revision linking back to source
  await captureRevision({
    tenantId,
    entityType: "ReusableComponent",
    entityId: id,
    snapshot: updated as unknown as Record<string, unknown>,
    createdByUserId: actorUserId,
    changeNote: `Wiederhergestellt aus Version ${revision.versionNumber}`,
    isRestore: true,
    parentRevisionId: revId,
  });

  await logAction({
    actorUserId,
    moduleKey: "reusable-components",
    entityType: "ReusableComponent",
    entityId: id,
    action: "RESTORE",
    metadataJson: { sourceRevisionId: revId, versionNumber: revision.versionNumber },
    afterJson: updated,
  });

  return NextResponse.json({ component: updated });
}
