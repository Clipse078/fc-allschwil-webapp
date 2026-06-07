/**
 * PATCH /api/website-navigation/[key]/items/[id] — update a navigation item.
 * DELETE /api/website-navigation/[key]/items/[id] — delete a navigation item.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  updateNavItem,
  deleteNavItem,
  type NavItemType,
} from "@/lib/navigation/admin-queries";

type RouteParams = { params: Promise<{ key: string; id: string }> };

const VALID_TYPES: NavItemType[] = ["PAGE", "CUSTOM_URL", "EXTERNAL_URL"];

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

  const rawType =
    typeof body.itemType === "string" ? body.itemType.toUpperCase() : undefined;
  const itemType =
    rawType && VALID_TYPES.includes(rawType as NavItemType)
      ? (rawType as NavItemType)
      : undefined;

  const updated = await updateNavItem(tenantId, id, {
    ...(typeof body.label === "string" ? { label: body.label.trim() } : {}),
    ...(itemType !== undefined ? { itemType } : {}),
    ...(body.url !== undefined
      ? { url: typeof body.url === "string" ? body.url.trim() || null : null }
      : {}),
    ...(body.pageId !== undefined
      ? { pageId: typeof body.pageId === "string" ? body.pageId || null : null }
      : {}),
    ...(body.parentId !== undefined
      ? { parentId: typeof body.parentId === "string" ? body.parentId || null : null }
      : {}),
    ...(body.isVisible !== undefined ? { isVisible: Boolean(body.isVisible) } : {}),
    ...(body.opensInNewTab !== undefined
      ? { opensInNewTab: Boolean(body.opensInNewTab) }
      : {}),
    ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Element nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ item: updated });
}

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
  const ok = await deleteNavItem(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Element nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
