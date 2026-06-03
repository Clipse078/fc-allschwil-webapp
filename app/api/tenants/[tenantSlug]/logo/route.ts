/**
 * Tenant Logo Upload — POST /api/tenants/[tenantSlug]/logo
 *
 * ─── Permission model ─────────────────────────────────────────────────────────
 * Requires: TENANTS_MANAGE
 * Tenant isolation: route is scoped to tenantSlug; only that tenant's record
 * is written. No cross-tenant access possible.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 * Files are written to public/images/logos/{tenantKey}.{ext} (local filesystem).
 * Path construction delegated to lib/assets/tenant-paths.ts — no path building here.
 * Validation delegated to lib/assets/validation.ts — no inline rules here.
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 * 200: { logoUrl: string }   — the new Tenant.logoUrl value
 * 400: { error: string }     — validation failure
 * 401/403: { error: string } — auth/permission failure
 * 404: { error: string }     — tenant not found
 * 500: { error: string }     — storage or DB error
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { validateLogoFile } from "@/lib/assets/validation";
import {
  getTenantLogoAbsolutePath,
  getTenantLogoPublicPath,
  getTenantLogosDir,
} from "@/lib/assets/tenant-paths";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { tenantSlug } = await params;

  // ── Tenant isolation ──────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
    select: { id: true, key: true, status: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }
  if (tenant.status === "ARCHIVED") {
    return NextResponse.json({ error: "Archivierter Tenant kann nicht bearbeitet werden." }, { status: 409 });
  }

  // ── Parse multipart body ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage (kein Multipart-Body)." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
  }

  // ── Validate file (MIME + size) ───────────────────────────────────────────
  const validation = validateLogoFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // ── Write to tenant-scoped path ───────────────────────────────────────────
  try {
    await mkdir(getTenantLogosDir(), { recursive: true });

    const absPath = getTenantLogoAbsolutePath(tenant.key, validation.ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);

    const logoUrl = getTenantLogoPublicPath(tenant.key, validation.ext);

    // ── Persist logoUrl on Tenant ─────────────────────────────────────────
    await prisma.tenant.update({
      where: { key: tenantSlug },
      data: { logoUrl },
    });

    return NextResponse.json({ logoUrl });
  } catch (err) {
    console.error("[logo-upload]", err);
    return NextResponse.json({ error: "Logo-Upload fehlgeschlagen. Bitte erneut versuchen." }, { status: 500 });
  }
}
