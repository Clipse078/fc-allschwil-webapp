/**
 * /api/branding — Self-service branding API for the authenticated user's own tenant.
 *
 * Unlike /api/tenants/[tenantSlug]/route.ts (which requires TENANTS_MANAGE and
 * accepts a URL-supplied slug), this route resolves the tenant exclusively from
 * session.user.tenantId — club admins can manage their own branding without
 * needing super-admin permissions.
 *
 * GET  → returns current { logoUrl, primaryColor, secondaryColor, tenantKey, tenantName }
 * PATCH → accepts { logoUrl?, primaryColor?, secondaryColor? }; validates hex colors
 *
 * Permission: USERS_MANAGE (club-admin level)
 * Tenant isolation: tenant resolved from session, never from user-supplied body
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { isValidHexColor } from "@/lib/tenant-runtime/branding-validation";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
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

  const tenant = await getTenantFromSession(access.session.user?.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  const data: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  } = {};

  if ("logoUrl" in body) {
    const raw = body.logoUrl;
    data.logoUrl = raw === null || raw === "" ? null : String(raw).trim();
  }

  if ("primaryColor" in body) {
    const raw = body.primaryColor;
    if (raw === null || raw === "") {
      data.primaryColor = null;
    } else {
      const v = String(raw).trim();
      if (!isValidHexColor(v)) {
        return NextResponse.json(
          { error: "primaryColor muss ein gültiger 6-stelliger Hex-Farbwert sein (z.B. #0b4aa2)." },
          { status: 400 },
        );
      }
      data.primaryColor = v;
    }
  }

  if ("secondaryColor" in body) {
    const raw = body.secondaryColor;
    if (raw === null || raw === "") {
      data.secondaryColor = null;
    } else {
      const v = String(raw).trim();
      if (!isValidHexColor(v)) {
        return NextResponse.json(
          { error: "secondaryColor muss ein gültiger 6-stelliger Hex-Farbwert sein (z.B. #c7332c)." },
          { status: 400 },
        );
      }
      data.secondaryColor = v;
    }
  }

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
