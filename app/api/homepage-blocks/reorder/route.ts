/**
 * POST /api/homepage-blocks/reorder
 *
 * Body: { orderedIds: string[] }
 * Updates sortOrder for all homepage instances to match the provided order.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reorderHomepageBlocks, listHomepageBlocks } from "@/lib/homepage/admin-queries";

export async function POST(request: NextRequest) {
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

  await reorderHomepageBlocks(tenantId, orderedIds);

  const blocks = await listHomepageBlocks(tenantId);
  return NextResponse.json({ blocks });
}
