/**
 * POST /api/workspace/documents
 *
 * Creates a tenant-scoped Workspace document with its immutable initial
 * version. Tenant and actor identity are derived exclusively from the
 * authenticated session.
 *
 * Permission: WORKSPACE_MANAGE
 * Body: multipart/form-data
 *   - file: required File
 *   - name: optional display name; defaults to sanitized filename
 *   - folderId: optional Workspace folder ID
 *   - changeNote: optional initial-version note
 *
 * Storage is written before the database transaction. If database creation
 * fails, the private Blob is deleted on a best-effort basis.
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  createWorkspaceDocumentWithInitialVersion,
  listWorkspaceDocuments,
  WorkspaceDocumentServiceError,
} from "@/lib/workspace/document-service";
import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";
import { validateWorkspaceUploadFile } from "@/lib/workspace/upload-types";

function getOptionalFormText(
  formData: FormData,
  key: string,
): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function mapDocumentServiceError(
  error: WorkspaceDocumentServiceError,
): number {
  switch (error.code) {
    case "INVALID_INPUT":
      return 400;

    case "FOLDER_NOT_FOUND":
      return 404;

    case "DUPLICATE_DOCUMENT_NAME":
      return 409;
  }
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

  const rawFolderId =
    request.nextUrl.searchParams.get("folderId");

  const folderId = rawFolderId?.trim() || null;

  try {
    const documents = await listWorkspaceDocuments({
      tenantId: tenant.id,
      folderId,
    });

    return NextResponse.json(
      {
        documents,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof WorkspaceDocumentServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: mapDocumentServiceError(error),
        },
      );
    }

    console.error(
      "[workspace-documents] document listing failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Die Dokumente konnten nicht geladen werden.",
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

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Ungültige Anfrage: multipart/form-data erwartet.",
      },
      {
        status: 400,
      },
    );
  }

  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      {
        error: "Kein Datei-Feld 'file' gefunden.",
      },
      {
        status: 400,
      },
    );
  }

  const validation = validateWorkspaceUploadFile(fileEntry);

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
      },
      {
        status: 400,
      },
    );
  }

  const folderId = getOptionalFormText(formData, "folderId");
  const changeNote = getOptionalFormText(
    formData,
    "changeNote",
  );
  const requestedName = getOptionalFormText(formData, "name");
  const documentName =
    requestedName ?? validation.filename;

  const documentId = randomUUID().replaceAll("-", "");

  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const uploadResult = await workspaceStorageProvider.upload({
    tenantKey: tenant.key,
    documentId,
    versionNumber: 1,
    filename: validation.filename,
    mimeType: validation.mimeType,
    buffer,
  });

  if (!uploadResult.ok) {
    return NextResponse.json(
      {
        error: uploadResult.error,
      },
      {
        status: uploadResult.status,
      },
    );
  }

  try {
    const document =
      await createWorkspaceDocumentWithInitialVersion({
        documentId,
        tenantId: tenant.id,
        folderId,
        name: documentName,
        filename: uploadResult.filename,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        storageKey: uploadResult.storageKey,
        storageUrl: uploadResult.storageUrl,
        checksum: uploadResult.checksum,
        changeNote,
        actorUserId,
      });

    return NextResponse.json(
      {
        document,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    await workspaceStorageProvider.delete(
      uploadResult.storageUrl ??
        uploadResult.storageKey,
    );

    if (error instanceof WorkspaceDocumentServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: mapDocumentServiceError(error),
        },
      );
    }

    console.error(
      "[workspace-documents] document creation failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Das Dokument konnte nicht erstellt werden.",
      },
      {
        status: 500,
      },
    );
  }
}