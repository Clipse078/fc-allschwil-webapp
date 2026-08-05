/**
 * GET  /api/website-pages/[id]/sections  — list page sections.
 * POST /api/website-pages/[id]/sections  — create a new page section.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 *             pageId from URL — ownership verified against tenantId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPageForTenant,
  listPageSections,
  createPageSection,
} from "@/lib/page-sections/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { validateSectionConfig } from "@/lib/homepage/config-schemas";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/website-pages/[id]/sections ─────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const sections = await listPageSections(tenantId, pageId);
  return NextResponse.json({ sections, meta: { total: sections.length } });
}

// ── POST /api/website-pages/[id]/sections ────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!type) {
    return NextResponse.json({ error: "Sektionstyp (type) ist erforderlich." }, { status: 400 });
  }

  const blockDef = getBlockDefinition(type);
  if (!blockDef) {
    return NextResponse.json(
      { error: `Unbekannter Blocktyp: "${type}".` },
      { status: 400 },
    );
  }

  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : blockDef.displayName;

  const rawConfig =
    body.config !== undefined &&
    body.config !== null &&
    typeof body.config === "object"
      ? (body.config as Record<string, unknown>)
      : blockDef.defaultConfig;

  const configResult = validateSectionConfig(type, rawConfig);
  if (!configResult.success) {
    return NextResponse.json(
      { error: "Ungültige Konfiguration.", details: configResult.errors },
      { status: 400 },
    );
  }

  const actorUserId = access.session.user?.id ?? null;
  const section = await createPageSection({
    tenantId,
    pageId,
    type,
    label,
    config: configResult.data,
    actorUserId,
  });

  return NextResponse.json({ section }, { status: 201 });
}
