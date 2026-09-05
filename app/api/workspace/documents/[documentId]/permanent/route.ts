/**
 * DELETE /api/workspace/documents/[documentId]/permanent
 *
 * ADMIN-DELETE-03A — permanent hard delete for a Workspace Document.
 *
 * Requires PERMISSIONS.WORKSPACE_DELETE — deliberately NOT WORKSPACE_MANAGE,
 * which authorizes upload/archive/restore but must never imply permanent
 * deletion on its own. A dedicated `/permanent` sub-route is used to keep
 * the existing archive route contract (POST .../archive) completely unchanged.
 *
 * Authorization model (mirrors training-series/[seriesId]/permanent/route.ts,
 * ADMIN-DELETE-02A-C1, and teams/[teamId]/route.ts DELETE, ADMIN-DELETE-01B):
 *
 *   1. The target document (and therefore its owning tenant) is resolved
 *      strictly server-side from `documentId` — a client-supplied tenantId
 *      is never read or trusted for this decision.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant. This grants
 *      access via either a tenant-scoped workspace.delete grant (Club Admin /
 *      delegated user) or the SCE Super Admin's platform-held workspace.delete
 *      grant resolved against the confirmed-active tenant.
 *
 * Two-step "inspect impact → explicit confirmation → delete" flow driven by
 * the `confirm` query parameter:
 *
 *   DELETE .../permanent            → PREVIEW: returns 200 with impact +
 *                                      requiresConfirmation: true. No mutation.
 *   DELETE .../permanent?confirm=true → PERFORM: deletes the document, all its
 *                                        versions (DB cascade), and the owned
 *                                        blobs (best-effort). See
 *                                        lib/workspace/document-delete-service.ts.
 *
 * Both steps require the same authorization check — the impact preview
 * never leaks dependency information to an unauthorized caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  deleteWorkspaceDocumentPermanently,
  getWorkspaceDocumentDeletionImpact,
  WorkspaceDocumentDeleteServiceError,
} from "@/lib/workspace/document-delete-service";

type Params = { params: Promise<{ documentId: string }> };

function mapDeleteServiceError(
  error: WorkspaceDocumentDeleteServiceError,
): number {
  switch (error.code) {
    case "INVALID_INPUT":
      return 400;
    case "DOCUMENT_NOT_FOUND":
      return 404;
    case "TENANT_FORBIDDEN":
      return 403;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  // Resolve the target document and its tenant strictly server-side — never
  // trust a client-supplied tenantId for a permanent-deletion decision.
  const document = await prisma.workspaceDocument.findUnique({
    where: { id: documentId },
    select: { id: true, tenantId: true, name: true },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden." },
      { status: 404 },
    );
  }

  const documentTenantId = document.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.WORKSPACE_DELETE,
    tenantId: documentTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    // Preview-only: return impact without deleting anything.
    const impact = await getWorkspaceDocumentDeletionImpact(
      documentTenantId,
      documentId,
    );

    if (impact === null) {
      return NextResponse.json(
        { error: "Dokument nicht gefunden." },
        { status: 404 },
      );
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  try {
    const result = await deleteWorkspaceDocumentPermanently(
      documentTenantId,
      documentId,
    );

    await logAction({
      tenantId: documentTenantId,
      actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
      moduleKey: "workspace",
      entityType: "WorkspaceDocument",
      entityId: documentId,
      action: "DELETE",
      beforeJson: { id: documentId, impact: result.impact },
    });

    revalidatePath("/dashboard/workspace");

    return NextResponse.json({
      message: "Dokument wurde endgültig gelöscht.",
      impact: result.impact,
    });
  } catch (error) {
    if (error instanceof WorkspaceDocumentDeleteServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: mapDeleteServiceError(error) },
      );
    }

    console.error("[workspace-documents] permanent delete failed", error);

    return NextResponse.json(
      { error: "Das Dokument konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
