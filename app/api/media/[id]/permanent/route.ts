/**
 * DELETE /api/media/[id]/permanent — MediaAsset permanent hard delete.
 *
 * ADMIN-HARD-DELETE-UI: Requires PERMISSIONS.WEBSITE_DELETE — media is web
 * content managed under the website module. A dedicated `/permanent` sub-route
 * preserves the existing DELETE /api/media/[id] soft-archive behavior unchanged.
 *
 * Two-step flow (confirm query param):
 *   DELETE .../permanent              → PREVIEW: returns impact + requiresConfirmation: true
 *   DELETE .../permanent?confirm=true → PERFORM: deletes DB record + best-effort blob delete
 *
 * Blob deletion: deleteMediaBlob() is best-effort and non-fatal.
 * The DB record is always removed even if blob deletion fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  getMediaAssetDeletionImpact,
  deleteMediaAssetPermanently,
} from "@/lib/media/media-delete-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Resolve tenant from the asset row — never from client.
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { tenantId: true, filename: true },
  });

  if (!asset) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  const tenantId = asset.tenantId;

  // Tenant isolation.
  if (session.user.activeTenantId && asset.tenantId !== session.user.activeTenantId) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.WEBSITE_DELETE,
    tenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getMediaAssetDeletionImpact(tenantId, id);
    if (impact === null) {
      return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  const result = await deleteMediaAssetPermanently(tenantId, id);
  if (!result) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  await logAction({
    actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
    moduleKey: "media",
    entityType: "MediaAsset",
    entityId: id,
    action: "DELETE",
    beforeJson: {
      filename: result.filename,
      blobDeleted: result.blobDeleted,
      impact: result.impact,
    },
  });

  return NextResponse.json({
    message: "Mediendatei wurde endgültig gelöscht.",
    blobDeleted: result.blobDeleted,
    impact: result.impact,
  });
}
