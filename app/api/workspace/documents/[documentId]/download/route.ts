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

type Params = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: Params,
) {
  const access = await requireApiPermission(
    PERMISSIONS.WORKSPACE_VIEW,
  );

  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
      },
      {
        status: access.status,
      },
    );
  }

  const sessionTenantId = access.session.user?.tenantId;

  if (!sessionTenantId) {
    return NextResponse.json(
      {
        error: "Kein Mandant in der Sitzung.",
      },
      {
        status: 403,
      },
    );
  }

  const tenant = await getTenantFromSession(sessionTenantId);

  if (!tenant) {
    return NextResponse.json(
      {
        error: "Tenant nicht gefunden.",
      },
      {
        status: 404,
      },
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
        {
          error: "Dokument nicht gefunden.",
        },
        {
          status: 404,
        },
      );
    }

    const downloadResult =
      await workspaceStorageProvider.download({
        storageReference: document.storageKey,
        filename: document.filename,
        mimeType: document.mimeType,
      });

    if (!downloadResult.ok) {
      return NextResponse.json(
        {
          error: downloadResult.error,
        },
        {
          status: downloadResult.status,
        },
      );
    }

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        downloadResult.contentDisposition,
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

    if (downloadResult.etag) {
      headers.set("ETag", downloadResult.etag);
    }

    return new Response(downloadResult.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof WorkspaceDocumentServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "[workspace-documents] document download failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Das Dokument konnte nicht heruntergeladen werden.",
      },
      {
        status: 500,
      },
    );
  }
}
