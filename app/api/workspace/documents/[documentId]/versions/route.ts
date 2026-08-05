import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  getDocumentVersions,
  WorkspaceDocumentVersionServiceError,
} from "@/lib/workspace/document-version-service";

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

  const { documentId } = await params;

  try {
    const versions = await getDocumentVersions({
      tenantId: tenant.id,
      actorUserId,
      documentId,
    });

    if (!versions) {
      return NextResponse.json(
        {
          error: "Dokument nicht gefunden.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        versions,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof
      WorkspaceDocumentVersionServiceError
    ) {
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
      "[workspace-documents] version history failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Der Versionsverlauf konnte nicht geladen werden.",
      },
      {
        status: 500,
      },
    );
  }
}