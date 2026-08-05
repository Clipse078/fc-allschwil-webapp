/**
 * /api/branding — Self-service branding API for the authenticated user's own tenant.
 *
 * Unlike /api/tenants/[tenantSlug]/route.ts (which requires TENANTS_MANAGE and
 * accepts a URL-supplied slug), this route resolves the tenant exclusively from
 * session.user.activeTenantId — club admins can manage their own branding without
 * needing super-admin permissions.
 *
 * GET  → returns current { logoUrl, primaryColor, secondaryColor, tenantKey, tenantName }
 * PATCH → accepts { logoUrl?, primaryColor?, secondaryColor? }; validates hex colors
 *
 * Permission: USERS_MANAGE (club-admin level)
 * Tenant isolation: tenant resolved from session, never from user-supplied body.
 *   Explicit tenantId guard ensures no fall-through to DEFAULT_TENANT_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { parseBrandingPatch } from "@/lib/tenant-runtime/branding-patch";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const branding = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: {
      key: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });
  if (!branding) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ branding });
}

export async function PATCH(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  const parsed = parseBrandingPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren angegeben." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data,
      select: { key: true, logoUrl: true, primaryColor: true, secondaryColor: true },
    });
    return NextResponse.json({ branding: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Branding konnte nicht gespeichert werden." }, { status: 500 });
  }
}
