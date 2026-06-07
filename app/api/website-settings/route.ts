/**
 * /api/website-settings — Self-service website settings API for the authenticated user's own tenant.
 *
 * Resolves tenant exclusively from session.user.tenantId — club admins can manage
 * their own website settings without needing super-admin (TENANTS_MANAGE) permissions.
 *
 * GET  → returns current { approvedDataOnly }
 * PATCH → accepts { approvedDataOnly: boolean }
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: tenant resolved from session, never from user-supplied body.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.tenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const settings = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { approvedDataOnly: true },
  });
  if (!settings) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.tenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  if (!("approvedDataOnly" in body)) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren angegeben." },
      { status: 400 },
    );
  }

  if (typeof body.approvedDataOnly !== "boolean") {
    return NextResponse.json(
      { error: "approvedDataOnly muss ein boolescher Wert sein." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { approvedDataOnly: body.approvedDataOnly },
      select: { approvedDataOnly: true },
    });
    return NextResponse.json({ settings: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
