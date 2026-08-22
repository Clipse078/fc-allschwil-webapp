import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import {
  downloadCommunicationAttachment,
} from "@/lib/communication/attachment-download-service";
import {
  CommunicationAttachmentServiceError,
} from "@/lib/communication/attachment-service";

type Context = {
  params: Promise<{ tenantSlug: string; attachmentId: string }>;
};

function attachmentDisposition(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function errorResponse(error: unknown) {
  if (error instanceof CommunicationAttachmentServiceError) {
    const status =
      error.code === "FORBIDDEN"
        ? 403
        : error.code === "ATTACHMENT_NOT_FOUND"
          ? 404
          : error.code === "ATTACHMENT_UNAVAILABLE"
            ? 423
            : error.code === "STORAGE_FAILED"
              ? 502
              : 400;
    return NextResponse.json(
      { error: error.message },
      {
        status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  console.error("Communication attachment download failed:", error);
  return NextResponse.json(
    { error: "Der Anhang konnte nicht geladen werden." },
    {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(_request: NextRequest, context: Context) {
  const { tenantSlug, attachmentId } = await context.params;
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json(
      { error: tenantResult.error },
      {
        status: tenantResult.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      {
        status: access.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const session = await auth();
  const actorUserId =
    session?.user?.effectiveUserId ?? session?.user?.id ?? null;
  if (!actorUserId) {
    return NextResponse.json(
      { error: "Nicht authentifiziert." },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  try {
    const result = await downloadCommunicationAttachment({
      tenantId: tenantResult.tenantId,
      actorUserId,
      attachmentId,
    });
    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.sizeBytes),
        "Content-Disposition": attachmentDisposition(result.filename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
