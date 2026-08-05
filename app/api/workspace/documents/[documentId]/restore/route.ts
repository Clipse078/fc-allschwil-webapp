import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  restoreWorkspaceDocument,
  WorkspaceDocumentRestoreServiceError,
} from "@/lib/workspace/document-restore-service";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

function mapRestoreServiceError(
  error: WorkspaceDocumentRestoreServiceError,
): number {
  switch (error.code) {
    case "INVALID_INPUT":
      return 400;

    case "DOCUMENT_NOT_FOUND":
      return 404;

    case "TENANT_FORBIDDEN":
      return 403;

    case "DOCUMENT_ALREADY_ACTIVE":
      return 409;
  }
}

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  const access = await requireApiPermission(
    PERMISSIONS.WORKSPACE_MANAGE,
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

  const sessionTenantId = access.session.user?.activeTenantId;

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

  const actorUserId = access.session.user?.id;

  if (!actorUserId) {
    return NextResponse.json(
      {
        error: "Benutzer-ID fehlt in der Sitzung.",
      },
      {
        status: 401,
      },
    );
  }

  const tenant = await getTenantFromSession(
    sessionTenantId,
  );

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

  const { documentId } = await context.params;

  try {
    await restoreWorkspaceDocument({
      tenantId: tenant.id,
      actorUserId,
      documentId,
    });

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof
      WorkspaceDocumentRestoreServiceError
    ) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: mapRestoreServiceError(error),
        },
      );
    }

    console.error(
      "[workspace-documents] document restore failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Das Dokument konnte nicht wiederhergestellt werden.",
      },
      {
        status: 500,
      },
    );
  }
}
