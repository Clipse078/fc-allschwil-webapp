/**
 * PATCH  /api/website-redirects/[id] — update a redirect.
 * DELETE /api/website-redirects/[id] — delete a redirect.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  updateWebsiteRedirect,
  deleteWebsiteRedirect,
} from "@/lib/website-config/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if ("fromPath" in body) data.fromPath = (body.fromPath as string).trim();
  if ("toPath" in body) data.toPath = (body.toPath as string).trim();
  if ("statusCode" in body) data.statusCode = Number(body.statusCode);
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("note" in body) data.note = typeof body.note === "string" ? body.note.trim() || null : null;

  const result = await updateWebsiteRedirect(tenantId, id, data);
  if (!result) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  return NextResponse.json({ redirect: result });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteWebsiteRedirect(tenantId, id);
  if (!ok) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
