/**
 * POST /api/matchcenter/bulk-wochenplan-visibility
 *
 * PUB-WEEKPLAN-VISIBILITY-01 — Bulk management of wochenplanVisible for
 * MATCH events from the MatchCenter surface.
 *
 * Body:
 *   {
 *     eventIds: string[],       // IDs of MATCH events to update
 *     wochenplanVisible: boolean
 *   }
 *
 * Guarantees:
 *   - Only MATCH-type events are updated (never TRAINING/TOURNAMENT/OTHER)
 *   - Only wochenplanVisible is mutated (websiteVisible, season, provider
 *     data, resource allocations are never touched)
 *   - Tenant isolation: only events owned by the actor's tenant are updated
 *   - IDs belonging to another tenant are silently excluded from the count
 *
 * Permission: EVENTS_MANAGE (MatchCenter canonical management permission)
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export async function POST(req: NextRequest) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { eventIds, wochenplanVisible } = body as Record<string, unknown>;

  if (
    !Array.isArray(eventIds) ||
    eventIds.length === 0 ||
    eventIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return NextResponse.json(
      { error: "eventIds muss ein nicht-leeres Array von Strings sein." },
      { status: 400 },
    );
  }

  if (typeof wochenplanVisible !== "boolean") {
    return NextResponse.json(
      { error: "wochenplanVisible muss ein Boolean sein." },
      { status: 400 },
    );
  }

  // Tenant isolation + MATCH-type guard: only update MATCH events that
  // belong to the actor's tenant. Cross-tenant IDs and non-MATCH event IDs
  // are silently excluded from the updateMany.
  const { count } = await prisma.event.updateMany({
    where: {
      id: { in: eventIds },
      tenantId,
      type: "MATCH",
    },
    data: { wochenplanVisible },
  });

  // Invalidate MatchCenter pages so subsequent visits reflect the new state.
  revalidatePath("/dashboard/matchcenter");

  return NextResponse.json({ updated: count });
}
