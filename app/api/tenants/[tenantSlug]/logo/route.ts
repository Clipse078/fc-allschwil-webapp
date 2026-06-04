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
 *
 * Upload execution delegated to executeLogoUpload() — canonical single source
 * of truth shared with /api/branding/logo.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { executeLogoUpload } from "@/lib/assets/logo-upload";

type RouteContext = { params: Promise<{ tenantSlug: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { key: tenantSlug },
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

  return executeLogoUpload(req, tenant);
}
