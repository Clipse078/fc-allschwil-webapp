/**
 * GET /api/workspace/documents/[documentId]/preview
 *
 * Returns a tenant-scoped Workspace document for inline browser display.
 *
 * Differences from the /download route:
 *   - Content-Disposition is always "inline" — the browser renders in place.
 *   - Only image/* and application/pdf are served inline; other types are
 *     redirected to the /download endpoint.
 *
 * Permission: WORKSPACE_VIEW
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  getWorkspaceDocumentForDownload,
  WorkspaceDocumentServiceError,
} from "@/lib/workspace/document-service";
import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";

const INLINE_MIME_PREFIXES = ["image/", "application/pdf"];

function isInlineSupported(mimeType: string): boolean {
  return INLINE_MIME_PREFIXES.some((prefix) =>
    mimeType.toLowerCase().startsWith(prefix),
  );
}

function safeFilename(raw: string): string {
  return raw.replace(/[^\w.\-]/g, "_").slice(0, 200);
}

type Params = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: Params,
) {
  const access = await requireApiPermission(
    PERMISSIONS.WORKSPACE_VIEW,
  );

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const sessionTenantId = access.session.user?.tenantId;

  if (!sessionTenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 403 },
    );
  }

  const tenant = await getTenantFromSession(sessionTenantId);

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden." },
      { status: 404 },
    );
  }

  const { documentId } = await params;

  try {
    const document = await getWorkspaceDocumentForDownload({
      tenantId: tenant.id,
      documentId,
    });

    if (!document) {
      return NextResponse.json(
        { error: "Dokument nicht gefunden." },
        { status: 404 },
      );
    }

    if (!isInlineSupported(document.mimeType)) {
      const downloadUrl = `/api/workspace/documents/${encodeURIComponent(documentId)}/download`;
      return NextResponse.redirect(
        new URL(downloadUrl, request.url),
      );
    }

    const downloadResult = await workspaceStorageProvider.download({
      storageReference: document.storageKey,
      filename: document.filename,
      mimeType: document.mimeType,
    });

    if (!downloadResult.ok) {
      return NextResponse.json(
        { error: downloadResult.error },
        { status: downloadResult.status },
      );
    }

    const headers = new Headers({
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `inline; filename="${safeFilename(document.filename)}"`,
      "Content-Type": downloadResult.contentType,
      "X-Content-Type-Options": "nosniff",
    });

    if (
      Number.isSafeInteger(downloadResult.sizeBytes) &&
      downloadResult.sizeBytes >= 0
    ) {
      headers.set(
        "Content-Length",
        String(downloadResult.sizeBytes),
      );
    }

    return new Response(downloadResult.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof WorkspaceDocumentServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    console.error(
      "[workspace-preview] document preview failed",
      error,
    );

    return NextResponse.json(
      { error: "Vorschau konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
