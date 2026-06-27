/**
 * PATCH  /api/website-pages/[id]/sections/[sectionId]  — update label/config.
 * DELETE /api/website-pages/[id]/sections/[sectionId]  — delete a section.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; page + section ownership verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPageForTenant,
  updatePageSection,
  deletePageSection,
} from "@/lib/page-sections/admin-queries";
import { validateSectionConfig } from "@/lib/homepage/config-schemas";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

// ── PATCH /api/website-pages/[id]/sections/[sectionId] ───────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId, sectionId } = await params;

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

  const actorUserId = access.session.user?.id ?? null;
  const input: { label?: string; config?: Record<string, unknown>; actorUserId?: string | null } = {
    actorUserId,
  };

  if (typeof body.label === "string") {
    const trimmed = body.label.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Label darf nicht leer sein." }, { status: 400 });
    }
    input.label = trimmed;
  }

  if (body.config !== undefined) {
    if (body.config === null || typeof body.config !== "object") {
      return NextResponse.json({ error: "config muss ein Objekt sein." }, { status: 400 });
    }
    // We need the section's type to validate config — fetch it first
    const existing = await updatePageSection(tenantId, pageId, sectionId, {});
    if (!existing) {
      return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
    }
    const configResult = validateSectionConfig(
      existing.type,
      body.config as Record<string, unknown>,
    );
    if (!configResult.success) {
      return NextResponse.json(
        { error: "Ungültige Konfiguration.", details: configResult.errors },
        { status: 400 },
      );
    }
    input.config = configResult.data;
  }

  const section = await updatePageSection(tenantId, pageId, sectionId, input);
  if (!section) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ section });
}

// ── DELETE /api/website-pages/[id]/sections/[sectionId] ──────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId, sectionId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const actorId = access.session.user?.id ?? null;
  const ok = await deletePageSection(tenantId, pageId, sectionId, actorId);
  if (!ok) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
