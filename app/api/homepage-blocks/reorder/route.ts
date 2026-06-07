/**
 * PATCH /api/homepage-blocks/reorder
 *
 * Applies a new sort order to homepage blocks.
 *
 * Body: { orderedIds: string[] }
 * — Ordered array of block IDs in the desired display order.
 * — IDs not belonging to the session tenant are silently ignored.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reorderHomepageBlocks } from "@/lib/homepage-blocks/admin-queries";

export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
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

  const orderedIds = body.orderedIds.filter((id): id is string => typeof id === "string");
  if (orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds ist leer." }, { status: 400 });
  }

  await reorderHomepageBlocks(tenantId, orderedIds);

  return NextResponse.json({ reordered: true });
}
