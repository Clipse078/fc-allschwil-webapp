/**
 * /api/website-design-system
 *
 * Admin API for tenant design system configuration.
 *
 * GET  → Returns current resolved design system + raw stored config.
 * PUT  → Saves full design system configuration.
 * DELETE → Resets design system to platform defaults.
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: resolved from session.user.activeTenantId — never from body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import {
  getResolvedDesignSystem,
  getRawDesignSystem,
  saveDesignSystem,
  resetDesignSystem,
} from "@/lib/website/design-system-queries";
import type { TenantDesignSystem } from "@/lib/website/design-system-types";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const [resolved, raw] = await Promise.all([
    getResolvedDesignSystem(tenant.id),
    getRawDesignSystem(tenant.id),
  ]);

  return NextResponse.json({
    ok: true,
    designSystem: resolved,
    raw,
    hasCustomConfig: raw !== null,
  });
}

export async function PUT(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültiger Request Body." }, { status: 400 });
  }

  await saveDesignSystem(tenant.id, body as TenantDesignSystem);

  const resolved = await getResolvedDesignSystem(tenant.id);

  return NextResponse.json({
    ok: true,
    designSystem: resolved,
  });
}

export async function DELETE() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const sessionTenantId = access.session.user?.activeTenantId;
  if (!sessionTenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tenant = await getTenantFromSession(sessionTenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  await resetDesignSystem(tenant.id);

  const resolved = await getResolvedDesignSystem(tenant.id);

  return NextResponse.json({
    ok: true,
    message: "Design System auf Plattform-Defaults zurückgesetzt.",
    designSystem: resolved,
  });
}
