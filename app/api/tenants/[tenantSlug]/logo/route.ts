import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { validateLogoUploadFile } from "@/lib/assets/validation";
import { uploadTenantLogo } from "@/lib/assets/storage";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

/**
 * POST /api/tenants/[tenantSlug]/logo
 *
 * Uploads a logo for the given tenant, stores it in Vercel Blob, and
 * persists the returned public URL to Tenant.logoUrl.
 *
 * Auth:         Session required (requireApiPermission).
 * Permission:   TENANTS_MANAGE.
 * Isolation:    tenantKey derived exclusively from the URL param — never from
 *               user-supplied body.
 * Body:         multipart/form-data with a single field named "file".
 * Returns:      { logoUrl: string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  // ── Auth & permission ────────────────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // ── Resolve tenant ───────────────────────────────────────────────────────
  const { tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, key: true, status: true },
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

  // ── Parse multipart body ─────────────────────────────────────────────────
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

  // ── First-pass validation (size + declared MIME) ─────────────────────────
  const validation = validateLogoUploadFile(fileEntry);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // ── Read bytes for magic-byte check + upload ─────────────────────────────
  const arrayBuffer = await fileEntry.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // ── Storage adapter (magic-byte check + Vercel Blob upload) ─────────────
  const uploadResult = await uploadTenantLogo(tenant.key, buffer, validation.mimeType);
  if (!uploadResult.ok) {
    return NextResponse.json({ error: uploadResult.error }, { status: 400 });
  }

  // ── Persist public URL ───────────────────────────────────────────────────
  await prisma.tenant.update({
    where: { key: tenant.key },
    data: { logoUrl: uploadResult.publicUrl },
  });

  return NextResponse.json({ logoUrl: uploadResult.publicUrl });
}
