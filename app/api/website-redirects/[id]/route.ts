/**
 * PATCH  /api/website-redirects/[id]  — update a redirect.
 * DELETE /api/website-redirects/[id]  — delete a redirect.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — cross-tenant access impossible.
 *
 * Introduced: CMS V4.2 — Website Platform UX Unification
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { updateWebsiteRedirect, deleteWebsiteRedirect } from "@/lib/website-redirects/queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── PATCH /api/website-redirects/[id] ────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const input: Record<string, unknown> = {};
  if (typeof body.fromPath === "string") input.fromPath = body.fromPath.trim();
  if (typeof body.toPath === "string") input.toPath = body.toPath.trim();
  if (typeof body.isPermanent === "boolean") input.isPermanent = body.isPermanent;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  const redirect = await updateWebsiteRedirect(tenantId, id, input);
  if (!redirect) {
    return NextResponse.json({ error: "Redirect nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ redirect });
}

// ── DELETE /api/website-redirects/[id] ───────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteWebsiteRedirect(tenantId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Redirect nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
