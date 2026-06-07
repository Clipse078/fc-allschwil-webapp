/**
 * POST /api/website-navigation/[key]/items
 * Creates a new navigation item in the MAIN or FOOTER group.
 *
 * [key] = "main" | "footer" (case-insensitive)
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNavGroupAdmin,
  createNavItem,
  type NavKey,
  type NavItemType,
} from "@/lib/navigation/admin-queries";

type RouteParams = { params: Promise<{ key: string }> };

const VALID_KEYS: NavKey[] = ["MAIN", "FOOTER"];
const VALID_TYPES: NavItemType[] = ["PAGE", "CUSTOM_URL", "EXTERNAL_URL"];

function parseKey(raw: string): NavKey | null {
  const upper = raw.toUpperCase() as NavKey;
  return VALID_KEYS.includes(upper) ? upper : null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { key: rawKey } = await params;
  const navKey = parseKey(rawKey);
  if (!navKey) {
    return NextResponse.json({ error: "Ungültiger Navigationsschlüssel." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "Label ist erforderlich." }, { status: 400 });
  }

  const rawType = typeof body.itemType === "string" ? body.itemType.toUpperCase() : "CUSTOM_URL";
  const itemType = VALID_TYPES.includes(rawType as NavItemType)
    ? (rawType as NavItemType)
    : "CUSTOM_URL";

  // Ensure nav group exists and get its ID
  const { id: navigationId } = (await getNavGroupAdmin(tenantId, navKey));

  const item = await createNavItem({
    tenantId,
    navigationId,
    label,
    itemType,
    url: typeof body.url === "string" ? body.url.trim() || null : null,
    pageId: typeof body.pageId === "string" ? body.pageId || null : null,
    parentId: typeof body.parentId === "string" ? body.parentId || null : null,
    isVisible: body.isVisible !== false,
    opensInNewTab: body.opensInNewTab === true,
  });

  return NextResponse.json({ item }, { status: 201 });
}
