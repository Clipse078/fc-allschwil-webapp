/**
 * POST /api/branding/logo
 *
 * Self-service logo upload for the authenticated user's own tenant.
 * Resolves the tenant from session.user.tenantId — no URL-supplied slug.
 *
 * Permission: USERS_MANAGE (club-admin level)
 * Isolation:  tenantKey derived from session, never from user-supplied body.
 * Body:       multipart/form-data with a single field named "file".
 * Returns:    { logoUrl: string }
 *
 * Orphan safety: previous Vercel Blob logo deleted (best-effort) after
 * successful upload when the URL changes (format switch: PNG→WebP, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { validateLogoUploadFile } from "@/lib/assets/validation";
import { uploadTenantLogo, deleteOrphanedLogo } from "@/lib/assets/storage";

export async function POST(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sessionTenantId = access.session.user?.tenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const sessionTenant = await getTenantFromSession(sessionTenantId);
  if (!sessionTenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: sessionTenant.id },
    select: { id: true, key: true, status: true, logoUrl: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }
  if (tenant.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Archivierter Tenant kann nicht bearbeitet werden." },
      { status: 409 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage: multipart/form-data erwartet." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Kein Datei-Feld 'file' im Formular gefunden." },
      { status: 400 },
    );
  }

  const validation = validateLogoUploadFile(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const uploadResult = await uploadTenantLogo(tenant.key, buffer, validation.mimeType);
  if (!uploadResult.ok) {
    return NextResponse.json(
      { error: uploadResult.error },
      { status: uploadResult.status },
    );
  }

  const newLogoUrl = uploadResult.publicUrl;
  const previousLogoUrl = tenant.logoUrl;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { logoUrl: newLogoUrl },
  });

  // Best-effort orphan cleanup — do not fail the request if delete fails.
  await deleteOrphanedLogo(previousLogoUrl, newLogoUrl).catch(() => undefined);

  return NextResponse.json({ logoUrl: newLogoUrl });
}
