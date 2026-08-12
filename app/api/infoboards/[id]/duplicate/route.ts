/**
 * app/api/infoboards/[id]/duplicate/route.ts
 *
 * POST /api/infoboards/[id]/duplicate
 *
 * Duplicates an Infoboard configuration into a new Infoboard with a new
 * stable identity (id + slug). The duplicate starts as DRAFT status.
 *
 * Permission: INFOBOARD_MANAGE
 * Tenant isolation: from session.user.activeTenantId only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { duplicateInfoboard } from "@/lib/infoboard/queries";

const REQUIRED_PERMISSIONS = [PERMISSIONS.INFOBOARD_MANAGE];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireApiAnyPermission(REQUIRED_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const duplicated = await duplicateInfoboard(id, tenantId);
  if (!duplicated) {
    return NextResponse.json({ error: "Infoboard nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ board: duplicated }, { status: 201 });
}
