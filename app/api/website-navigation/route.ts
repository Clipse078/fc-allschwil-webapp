/**
 * GET  /api/website-navigation     — list all nav items for tenant (grouped by area).
 * POST /api/website-navigation     — create a new nav item.
 * POST /api/website-navigation?bootstrap=1 — bootstrap default nav items.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listNavItemsGrouped,
  countNavItems,
  createNavItem,
  bootstrapDefaultNavItems,
  type CreateNavItemInput,
} from "@/lib/navigation/admin-queries";

// ── GET /api/website-navigation ──────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const grouped = await listNavItemsGrouped(tenantId);
  const total = await countNavItems(tenantId);

  return NextResponse.json({ areas: grouped, meta: { total } });
}

// ── POST /api/website-navigation ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  // Bootstrap mode: ?bootstrap=1
  const url = new URL(request.url);
  if (url.searchParams.get("bootstrap") === "1") {
    const existing = await countNavItems(tenantId);
    if (existing > 0) {
      return NextResponse.json(
        { error: "Standard-Navigation kann nicht erstellt werden — dieser Mandant hat bereits Navigationselemente.", existing },
        { status: 409 },
      );
    }
    const created = await bootstrapDefaultNavItems(tenantId);
    return NextResponse.json({ created }, { status: 201 });
  }

  // Regular create
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const input: CreateNavItemInput = {
    parentId: (body.parentId as string | null) ?? null,
    area: (body.area as string) ?? "",
    label: (body.label as string) ?? "",
    linkType: (body.linkType as string) ?? "INTERNAL",
    href: (body.href as string | null) ?? null,
    target: (body.target as string) ?? "SELF",
    sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    isVisible: body.isVisible !== undefined ? Boolean(body.isVisible) : true,
    visibilityMode: (body.visibilityMode as string) ?? "ALWAYS",
    icon: typeof body.icon === "string" ? body.icon || null : null,
    megaMenu: body.megaMenu !== undefined ? Boolean(body.megaMenu) : false,
    description: typeof body.description === "string" ? body.description || null : null,
    badge: typeof body.badge === "string" ? body.badge || null : null,
    scheduleFrom: typeof body.scheduleFrom === "string" && body.scheduleFrom ? new Date(body.scheduleFrom) : null,
    scheduleTo: typeof body.scheduleTo === "string" && body.scheduleTo ? new Date(body.scheduleTo) : null,
  };

  const result = await createNavItem(tenantId, input);

  if ("code" in result) {
    const status =
      result.code === "PARENT_NOT_FOUND" ? 404
      : result.code === "MAX_DEPTH" ? 422
      : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({ item: result }, { status: 201 });
}
