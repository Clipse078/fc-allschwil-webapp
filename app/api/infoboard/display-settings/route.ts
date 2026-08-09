/**
 * /api/infoboard/display-settings — Infoboard display-theme preference.
 *
 * INFOBOARD-INTEGRATION-01B — smallest coherent persistence for the
 * Dark/Light Infoboard display preference. Presentation only: this route
 * never touches planning data, Betriebsplan resolution, publication policy,
 * or resource allocation — it reads/writes exactly one Tenant column
 * (Tenant.infoboardDisplayTheme).
 *
 * GET   → returns { theme } for the authenticated user's active tenant.
 * PATCH → accepts { theme: "DARK" | "LIGHT" }; persists it on Tenant.
 *
 * Permission: INFOBOARD_MANAGE or EVENTS_PUBLISH_INFOBOARD (same gate as the
 * Infoboard admin page — see app/(admin)/dashboard/infoboard/page.tsx).
 * Tenant isolation: tenant resolved from session.user.activeTenantId only —
 * never from a client-supplied tenantId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  resolveInfoboardDisplayTheme,
  isInfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";

const REQUIRED_PERMISSIONS = [
  PERMISSIONS.INFOBOARD_MANAGE,
  PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
];

export async function GET() {
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: sessionTenantId },
    select: { infoboardDisplayTheme: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    theme: resolveInfoboardDisplayTheme(tenant.infoboardDisplayTheme),
  });
}

export async function PATCH(req: NextRequest) {
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawTheme = typeof body?.theme === "string" ? body.theme.trim().toUpperCase() : null;

  if (!isInfoboardDisplayTheme(rawTheme)) {
    return NextResponse.json(
      { error: "theme muss 'DARK' oder 'LIGHT' sein." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: sessionTenantId },
      data: { infoboardDisplayTheme: rawTheme },
      select: { infoboardDisplayTheme: true },
    });
    return NextResponse.json({
      theme: resolveInfoboardDisplayTheme(updated.infoboardDisplayTheme),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Anzeige-Theme konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
