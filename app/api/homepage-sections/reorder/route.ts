/**
 * PATCH /api/homepage-sections/reorder
 *
 * Bulk reorders all homepage sections for the authenticated tenant.
 * Accepts a new ordered array of section IDs; reassigns sortOrder = index * 10.
 *
 * Body: { orderedIds: string[] }
 *
 * All IDs must belong to the tenant. The count must match exactly.
 * Returns the full updated section list.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reorderHomepageSections } from "@/lib/homepage/admin-queries";

export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const orderedIds = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "orderedIds muss ein String-Array sein." },
      { status: 400 },
    );
  }

  const sections = await reorderHomepageSections(tenantId, orderedIds as string[]);
  if (!sections) {
    return NextResponse.json(
      { error: "Ungültige Sektions-IDs, Duplikate oder falsche Anzahl." },
      { status: 400 },
    );
  }

  return NextResponse.json({ sections });
}
