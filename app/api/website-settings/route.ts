/**
 * /api/website-settings — Self-service website settings API for the authenticated user's own tenant.
 *
 * Resolves tenant exclusively from session.user.tenantId — club admins can manage
 * their own website settings without needing super-admin (TENANTS_MANAGE) permissions.
 *
 * GET  → returns current website settings including publish mode, base URL, etc.
 * PATCH → accepts partial website settings update
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: tenant resolved from session, never from user-supplied body.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";

const WEBSITE_SETTINGS_SELECT = {
  approvedDataOnly: true,
  websiteEnabled: true,
  websiteBaseUrl: true,
  websitePrimaryLanguage: true,
  websitePublishMode: true,
  websiteLastPublishedAt: true,
  websiteCacheStrategy: true,
} as const;

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
    select: WEBSITE_SETTINGS_SELECT,
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

  const ALLOWED_FIELDS = [
    "approvedDataOnly",
    "websiteEnabled",
    "websiteBaseUrl",
    "websitePrimaryLanguage",
    "websitePublishMode",
    "websiteCacheStrategy",
  ] as const;

  type AllowedField = (typeof ALLOWED_FIELDS)[number];

  const updates: Partial<Record<AllowedField, unknown>> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren angegeben." },
      { status: 400 },
    );
  }

  // Validate types
  if ("approvedDataOnly" in updates && typeof updates.approvedDataOnly !== "boolean") {
    return NextResponse.json({ error: "approvedDataOnly muss ein boolescher Wert sein." }, { status: 400 });
  }
  if ("websiteEnabled" in updates && typeof updates.websiteEnabled !== "boolean") {
    return NextResponse.json({ error: "websiteEnabled muss ein boolescher Wert sein." }, { status: 400 });
  }
  if ("websiteBaseUrl" in updates && updates.websiteBaseUrl !== null && typeof updates.websiteBaseUrl !== "string") {
    return NextResponse.json({ error: "websiteBaseUrl muss ein String oder null sein." }, { status: 400 });
  }
  if ("websitePrimaryLanguage" in updates && updates.websitePrimaryLanguage !== null && typeof updates.websitePrimaryLanguage !== "string") {
    return NextResponse.json({ error: "websitePrimaryLanguage muss ein String oder null sein." }, { status: 400 });
  }
  if ("websiteCacheStrategy" in updates && updates.websiteCacheStrategy !== null && typeof updates.websiteCacheStrategy !== "string") {
    return NextResponse.json({ error: "websiteCacheStrategy muss ein String oder null sein." }, { status: 400 });
  }
  if ("websitePublishMode" in updates) {
    const VALID_MODES = ["DRAFT", "STAGED", "LIVE"];
    if (!VALID_MODES.includes(updates.websitePublishMode as string)) {
      return NextResponse.json({ error: "websitePublishMode muss DRAFT, STAGED oder LIVE sein." }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: updates as Parameters<typeof prisma.tenant.update>[0]["data"],
      select: WEBSITE_SETTINGS_SELECT,
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
