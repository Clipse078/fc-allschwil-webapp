/**
 * POST /api/wochenplan/publish
 *
 * Bulk-sets wochenplanVisible (and optionally websiteVisible, infoboardVisible)
 * for a list of event IDs. Used by the Wochenplan board's publish bar.
 *
 * Body:
 *   { eventIds: string[], wochenplanVisible: boolean }
 *
 * Permission: WOCHENPLAN_MANAGE or EVENTS_MANAGE
 * Tenant isolation: only event IDs belonging to the actor's tenant are updated.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export async function POST(req: NextRequest) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.WOCHENPLAN_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const actorTenantId = access.session?.user?.tenantId ?? null;

  const body = await req.json().catch(() => ({}));
  const { eventIds, wochenplanVisible } = body;

  if (!Array.isArray(eventIds) || eventIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "eventIds muss ein Array von Strings sein." }, { status: 400 });
  }
  if (typeof wochenplanVisible !== "boolean") {
    return NextResponse.json({ error: "wochenplanVisible muss ein Boolean sein." }, { status: 400 });
  }

  // Tenant isolation: restrict updateMany to events owned by this tenant.
  // When actor has no tenantId (legacy/bootstrap), fall through to all provided IDs.
  const tenantFilter = actorTenantId
    ? { id: { in: eventIds }, tenantId: actorTenantId }
    : { id: { in: eventIds } };

  const { count } = await prisma.event.updateMany({
    where: tenantFilter,
    data: { wochenplanVisible },
  });

  return NextResponse.json({ updated: count });
}
