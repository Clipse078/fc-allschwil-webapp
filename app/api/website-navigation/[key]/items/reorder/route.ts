/**
 * POST /api/website-navigation/[key]/items/reorder
 * Atomically reassigns sortOrder for a set of sibling items.
 *
 * Body: { orderedIds: string[], parentId?: string | null }
 *   - orderedIds: IDs in desired order; must all share the same parentId scope.
 *   - parentId: null (or omitted) → reorder top-level items;
 *               string → reorder children of that parent.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNavGroupAdmin,
  reorderNavItems,
  type NavKey,
} from "@/lib/navigation/admin-queries";

type RouteParams = { params: Promise<{ key: string }> };

const VALID_KEYS: NavKey[] = ["MAIN", "FOOTER"];

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
  const navKey = VALID_KEYS.includes(rawKey.toUpperCase() as NavKey)
    ? (rawKey.toUpperCase() as NavKey)
    : null;
  if (!navKey) {
    return NextResponse.json({ error: "Ungültiger Navigationsschlüssel." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: "orderedIds muss ein Array sein." }, { status: 400 });
  }

  const orderedIds = (body.orderedIds as unknown[]).filter(
    (id): id is string => typeof id === "string",
  );

  // parentId scopes the reorder: null = top-level, string = children of that parent
  const parentId =
    typeof body.parentId === "string" ? body.parentId
    : body.parentId === null ? null
    : null;

  const navGroup = await getNavGroupAdmin(tenantId, navKey);
  await reorderNavItems(tenantId, navGroup.id, orderedIds, parentId);

  const updated = await getNavGroupAdmin(tenantId, navKey);
  return NextResponse.json({ navigation: updated });
}
