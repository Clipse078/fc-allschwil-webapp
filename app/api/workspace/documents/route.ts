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
 *
 * Runtime: Node.js is required for multipart/form-data parsing and
 * @vercel/blob server-side uploads. The Edge runtime does not support
 * the Node.js crypto module used for checksums.
 */

export const runtime = "nodejs";

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
import type { WorkspaceDocumentDto } from "@/lib/workspace/document-dto";
import { workspaceStorageProvider } from "@/lib/workspace/upload-storage";
import { validateWorkspaceUploadFile } from "@/lib/workspace/upload-types";
import {
  TeamDocumentValidationError,
  validateTeamDocumentUpload,
} from "@/lib/teams/team-document-validation";

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

function toClientWorkspaceDocument(
  document: WorkspaceDocumentDto,
) {
  return {
    id: document.id,
    folderId: document.folderId,
    name: document.name,
    status: document.status,
    currentVersionId: document.currentVersionId,
    createdByUserId: document.createdByUserId,
    updatedByUserId: document.updatedByUserId,
    archivedAt: document.archivedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    currentVersion: document.currentVersion
      ? {
          id: document.currentVersion.id,
          documentId: document.currentVersion.documentId,
          versionNumber: document.currentVersion.versionNumber,
          status: document.currentVersion.status,
          filename: document.currentVersion.filename,
          mimeType: document.currentVersion.mimeType,
          sizeBytes: document.currentVersion.sizeBytes,
          checksum: document.currentVersion.checksum,
          changeNote: document.currentVersion.changeNote,
          createdByUserId:
            document.currentVersion.createdByUserId,
          createdAt: document.currentVersion.createdAt,
        }
      : null,
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

  const tenantId = access.session.user?.activeTenantId;

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

  const tenantId = access.session.user?.activeTenantId;

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

  try {
    await validateTeamDocumentUpload({
      filename: fileEntry.name,
      declaredContentType: fileEntry.type,
      buffer,
    });
  } catch (error) {
    if (error instanceof TeamDocumentValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    throw error;
  }

  const uploadResult = await workspaceStorageProvider.upload({
    tenantKey: tenant.key,
    documentId,
    versionNumber: 1,
    filename: validation.filename,
    mimeType: validation.mimeType,
    buffer,
  });

  if (!uploadResult.ok) {
    const body: { error: string; code?: string } = {
      error: uploadResult.error,
    };
    if (uploadResult.code !== undefined) {
      body.code = uploadResult.code;
    }
    return NextResponse.json(body, {
      status: uploadResult.status,
    });
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
        document: toClientWorkspaceDocument(document),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    await workspaceStorageProvider.delete(
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
        code: "WORKSPACE_UPLOAD_PERSISTENCE_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}