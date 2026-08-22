import { NextRequest, NextResponse } from "next/server";
import {
  EmailSenderSettingsError,
  getTenantEmailSenderSettings,
  updateTenantEmailSenderSettings,
} from "@/lib/communication/email-sender-service";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { TENANT_ADMINISTRATION_PERMISSIONS } from "@/lib/permissions/tenant-administration";

export const dynamic = "force-dynamic";

function serviceErrorResponse(error: unknown): NextResponse {
  if (error instanceof EmailSenderSettingsError) {
    return NextResponse.json(
      { error: error.message, field: error.field },
      { status: error.code === "TENANT_NOT_FOUND" ? 404 : 400 },
    );
  }
  console.error("Tenant email sender settings failed:", error);
  return NextResponse.json(
    { error: "E-Mail-Absender konnte nicht verarbeitet werden." },
    { status: 500 },
  );
}

export async function GET(): Promise<NextResponse> {
  const access = await requireApiAnyPermission(TENANT_ADMINISTRATION_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 403 });
  }

  try {
    return NextResponse.json({
      settings: await getTenantEmailSenderSettings(tenantId),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const access = await requireApiAnyPermission(TENANT_ADMINISTRATION_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const actorUserId =
    access.session.user.effectiveUserId ?? access.session.user.id;

  try {
    const settings = await updateTenantEmailSenderSettings({
      tenantId,
      actorUserId,
      displayName: raw.displayName,
      emailAddress: raw.emailAddress,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
