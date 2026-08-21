/**
 * POST /api/tenants/[tenantSlug]/waiting-list/[entryId]/place
 *
 * REG-WAIT-01: Placement action — moves a WaitingListEntry to PLACED status,
 * creates a PlayerSquadMember (for player-type registrations with a TeamSeason),
 * and moves the Registration to ACCEPTED.
 *
 * Authorization: REGISTRATIONS_EDIT.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { placeWaitingListEntry } from "@/lib/registrations/waiting-list-service";

type Context = { params: Promise<{ tenantSlug: string; entryId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { tenantSlug, entryId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission([PERMISSIONS.REGISTRATIONS_EDIT], tenantResult.tenantId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = await auth();
  const actorUserId = session?.user?.effectiveUserId ?? session?.user?.id ?? null;

  try {
    const body = await request.json().catch(() => ({}));
    const { teamSeasonId } = body as { teamSeasonId?: string | null };

    const entry = await placeWaitingListEntry(tenantSlug, entryId, { teamSeasonId }, actorUserId);

    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Platzierung konnte nicht durchgeführt werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
