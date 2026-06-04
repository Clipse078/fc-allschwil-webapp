/**
 * POST /api/branding/logo
 *
 * Self-service logo upload for the authenticated user's own tenant.
 * Resolves the tenant from session.user.tenantId — no URL-supplied slug.
 *
 * Permission: USERS_MANAGE (club-admin level)
 * Isolation:  tenantKey derived from session, never from user-supplied body.
 *   Explicit tenantId guard ensures no fall-through to DEFAULT_TENANT_KEY.
 * Body:       multipart/form-data with a single field named "file".
 * Returns:    { logoUrl: string }
 *
 * Upload execution delegated to executeLogoUpload() — canonical single source
 * of truth shared with /api/tenants/[tenantSlug]/logo.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { executeLogoUpload } from "@/lib/assets/logo-upload";

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

  return executeLogoUpload(req, tenant);
}
