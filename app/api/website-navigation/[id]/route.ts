/**
 * PATCH /api/website-navigation/[id] — update a nav item.
 * DELETE /api/website-navigation/[id] — delete a nav item (safe: blocked if has children).
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; item ownership verified in query layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  updateNavItem,
  deleteNavItem,
  type UpdateNavItemInput,
} from "@/lib/navigation/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── PATCH /api/website-navigation/[id] ───────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const { id } = await params;

  const input: UpdateNavItemInput = {};
  if ("label" in body) input.label = body.label as string;
  if ("area" in body) input.area = body.area as string;
  if ("linkType" in body) input.linkType = body.linkType as string;
  if ("href" in body) input.href = body.href as string | null;
  if ("target" in body) input.target = body.target as string;
  if ("sortOrder" in body) input.sortOrder = Number(body.sortOrder);
  if ("isVisible" in body) input.isVisible = Boolean(body.isVisible);
  if ("visibilityMode" in body) input.visibilityMode = body.visibilityMode as string;
  if ("parentId" in body) input.parentId = body.parentId as string | null;

  const result = await updateNavItem(tenantId, id, input);

  if ("code" in result) {
    const status =
      result.code === "NOT_FOUND" ? 404
      : result.code === "PARENT_NOT_FOUND" ? 404
      : result.code === "CIRCULAR_PARENT" ? 422
      : result.code === "MAX_DEPTH" ? 422
      : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({ item: result });
}

// ── DELETE /api/website-navigation/[id] ──────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  // ADMIN-HARD-DELETE-UI-UPLIFT: permanent deletion requires website.delete,
  // not website.manage. Manage permission is preserved for all other operations.
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_DELETE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const result = await deleteNavItem(tenantId, id);

  if (result !== true) {
    const status = result.code === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({ deleted: true });
}
