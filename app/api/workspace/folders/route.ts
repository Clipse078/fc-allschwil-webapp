/**
 * GET /api/workspace/folders
 *
 * Lists active Workspace folders for the authenticated tenant.
 *
 * Permission: WORKSPACE_VIEW
 * Query:
 *   - parentId: optional parent folder ID; blank means Workspace root
 *
 * POST /api/workspace/folders
 *
 * Creates a tenant-scoped Workspace folder.
 *
 * Permission: WORKSPACE_MANAGE
 * Body: application/json
 *   - parentId: optional parent folder ID
 *   - name: required folder name
 *   - description: optional folder description
 *   - displayOrder: optional non-negative integer
 *
 * Tenant and actor identity are derived exclusively from the
 * authenticated session.
 */

import { NextRequest, NextResponse } from "next/server";

import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  toCreateWorkspaceFolderResponseDto,
  toWorkspaceFolderListResponseDto,
  type CreateWorkspaceFolderRequestDto,
} from "@/lib/workspace/folder-dto";
import {
  createWorkspaceFolder,
  listWorkspaceFolders,
  WorkspaceFolderServiceError,
} from "@/lib/workspace/folder-service";

function mapFolderServiceError(
  error: WorkspaceFolderServiceError,
): number {
  switch (error.code) {
    case "INVALID_INPUT":
      return 400;

    case "PARENT_FOLDER_NOT_FOUND":
      return 404;

    case "DUPLICATE_FOLDER_NAME":
      return 409;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseOptionalString(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      `${fieldName} muss eine Zeichenkette oder null sein.`,
    );
  }

  return value;
}

function parseRequiredString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string") {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      `${fieldName} muss eine Zeichenkette sein.`,
    );
  }

  return value;
}

function parseOptionalDisplayOrder(
  value: unknown,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number") {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      "displayOrder muss eine Zahl sein.",
    );
  }

  return value;
}

function parseCreateFolderRequest(
  value: unknown,
): CreateWorkspaceFolderRequestDto {
  if (!isRecord(value)) {
    throw new WorkspaceFolderServiceError(
      "INVALID_INPUT",
      "Ungueltige Anfrage: JSON-Objekt erwartet.",
    );
  }

  return {
    parentId: parseOptionalString(
      value.parentId,
      "parentId",
    ),
    name: parseRequiredString(
      value.name,
      "name",
    ),
    description: parseOptionalString(
      value.description,
      "description",
    ),
    displayOrder: parseOptionalDisplayOrder(
      value.displayOrder,
    ),
  };
}

export async function GET(request: NextRequest) {
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

  const tenantId = access.session.user?.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Kein Mandant in der Sitzung.",
      },
      {
        status: 403,
      },
    );
  }

  const tenant = await getTenantFromSession(tenantId);

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

  const rawParentId =
    request.nextUrl.searchParams.get("parentId");

  const parentId = rawParentId?.trim() || null;

  try {
    const folders = await listWorkspaceFolders({
      tenantId: tenant.id,
      parentId,
    });

    return NextResponse.json(
      toWorkspaceFolderListResponseDto(folders),
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof WorkspaceFolderServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: mapFolderServiceError(error),
        },
      );
    }

    console.error(
      "[workspace-folders] folder listing failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Die Ordner konnten nicht geladen werden.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
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

  const tenantId = access.session.user?.tenantId;

  if (!tenantId) {
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

  const tenant = await getTenantFromSession(tenantId);

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

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Ungueltige Anfrage: JSON erwartet.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const body = parseCreateFolderRequest(rawBody);

    const folder = await createWorkspaceFolder({
      tenantId: tenant.id,
      parentId: body.parentId,
      name: body.name,
      description: body.description,
      displayOrder: body.displayOrder,
      actorUserId,
    });

    return NextResponse.json(
      toCreateWorkspaceFolderResponseDto(folder),
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof WorkspaceFolderServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: mapFolderServiceError(error),
        },
      );
    }

    console.error(
      "[workspace-folders] folder creation failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Der Ordner konnte nicht erstellt werden.",
      },
      {
        status: 500,
      },
    );
  }
}