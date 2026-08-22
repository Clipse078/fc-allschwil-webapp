import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createUploadedAttachment, CommunicationAttachmentServiceError } from "@/lib/communication/attachment-service";
import {
  CommunicationAttachmentValidationError,
  MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES,
} from "@/lib/communication/attachment-validation";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";

export const runtime = "nodejs";

type Context = { params: Promise<{ tenantSlug: string }> };

function errorResponse(error: unknown) {
  if (error instanceof CommunicationAttachmentValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "FILE_TOO_LARGE" ? 413 : 400 },
    );
  }
  if (error instanceof CommunicationAttachmentServiceError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code === "STORAGE_FAILED" || error.code === "PERSISTENCE_FAILED"
          ? 502
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Communication attachment upload failed:", error);
  return NextResponse.json(
    { error: "Die Datei konnte nicht gespeichert werden." },
    { status: 500 },
  );
}

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json(
      { error: tenantResult.error },
      { status: tenantResult.status },
    );
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId =
    session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  if (!actorUserId) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File)) {
      return NextResponse.json(
        { error: "Bitte genau eine Datei auswählen." },
        { status: 400 },
      );
    }
    const file = files[0];
    if (file.size > MAX_COMMUNICATION_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Die Datei überschreitet 10 MiB." },
        { status: 413 },
      );
    }

    const attachment = await createUploadedAttachment({
      tenantId: tenantResult.tenantId,
      actorUserId,
      filename: file.name,
      declaredContentType: file.type,
      buffer: new Uint8Array(await file.arrayBuffer()),
      ingestionMetadata: { source: "EMAIL_COMPOSER" },
    });

    return NextResponse.json(
      {
        attachment: {
          attachmentId: attachment.id,
          filename: attachment.sanitizedFilename,
          contentType: attachment.contentType,
          size: attachment.sizeBytes,
          status: attachment.lifecycleStatus,
          scanStatus: attachment.scanStatus,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
