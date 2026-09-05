/**
 * PATCH /api/wochenplan/[eventId]/allocation
 *
 * Persists pitch and dressing-room allocation for a single event.
 * Body: { pitchCode: string | null, homeDressingRoomCode: string | null, awayDressingRoomCode: string | null }
 *
 * Permission: WOCHENPLAN_MANAGE or EVENTS_MANAGE
 * Tenant isolation: only events belonging to the actor's tenant can be modified.
 *
 * MASTERDATA-CONSISTENCY-02: submitted codes are validated against active,
 * tenant-scoped FacilityResource rows (lib/facilities/queries.ts) instead of
 * the static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS registries. Tenant
 * identity is derived from the trusted Event row (and the actor's session),
 * never from a client-supplied tenant id. Resource-type semantics are
 * preserved: pitchCode must resolve to a PITCH_HALL-group resource
 * (FULL_PITCH/HALF_PITCH), dressing-room codes must resolve to a
 * DRESSING_ROOM-typed resource.
 *
 * MASTERDATA-CONSISTENCY-02-C2: a field is only required to resolve to an
 * active resource when its submitted value actually CHANGES the currently
 * persisted value. An unchanged field is allowed to remain as-is even if its
 * resource has since been archived — historical compatibility means the
 * existing value stays readable/persistable, not that an archived resource
 * becomes freely (re)assignable. Any genuinely new/changed value — including
 * switching from one archived code to another — still must resolve to an
 * active, correctly-typed, tenant-scoped resource.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveFacilityResourcesByCodesForTenant } from "@/lib/facilities/queries";
import {
  getWochenplanPlan,
  upsertWochenplanPlanAllocation,
} from "@/lib/wochenplan/plan-service";
import {
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
  WochenplanPlanAllocationEventNotFoundError,
} from "@/lib/wochenplan/plan-errors";
import type { FacilityResourceType } from "@prisma/client";

type RouteContext = { params: Promise<{ eventId: string }> };

const PITCH_HALL_TYPES: FacilityResourceType[] = ["FULL_PITCH", "HALF_PITCH"];
const DRESSING_ROOM_TYPES: FacilityResourceType[] = ["DRESSING_ROOM"];

type CodeValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

function validateNullableCode(
  value: unknown,
  field: string,
  resourcesByCode: Map<string, { name: string; type: FacilityResourceType }>,
  allowedTypes: FacilityResourceType[],
  currentValue: string | null,
): CodeValidationResult {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} muss ein String oder null sein.` };
  }

  // Unchanged historical compatibility: re-persisting the SAME value that is
  // already stored on this event is always allowed, even if that resource
  // has since been archived. Only a value that actually differs from what is
  // currently persisted is treated as a new assignment and must resolve to
  // an active resource below.
  if (value === currentValue) {
    return { ok: true, value };
  }

  const resource = resourcesByCode.get(value);
  if (!resource) {
    return { ok: false, error: `Ungültiger ${field}: ${value}` };
  }

  if (!allowedTypes.includes(resource.type)) {
    return { ok: false, error: `Ungültiger ${field}: ${value} hat einen unpassenden Ressourcentyp.` };
  }

  return { ok: true, value };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.WOCHENPLAN_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const actorTenantId = access.session?.user?.activeTenantId ?? null;
  if (!actorTenantId) {
    return NextResponse.json({ error: "Kein Mandanten-Kontext." }, { status: 403 });
  }

  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: actorTenantId },
    select: {
      id: true,
      tenantId: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });

  const tenantId = actorTenantId;

  // Only codes that actually change value need to resolve to an active
  // resource — an unchanged code may remain even if it is now archived (see
  // validateNullableCode's currentValue bypass above).
  const changedCodes = [
    { value: body.pitchCode, current: event.pitchCode },
    { value: body.homeDressingRoomCode, current: event.homeDressingRoomCode },
    { value: body.awayDressingRoomCode, current: event.awayDressingRoomCode },
  ]
    .filter(
      (c): c is { value: string; current: string | null } =>
        typeof c.value === "string" && c.value !== c.current,
    )
    .map((c) => c.value);

  const resourcesByCode = tenantId
    ? await getActiveFacilityResourcesByCodesForTenant(changedCodes, tenantId)
    : new Map<string, { name: string; type: FacilityResourceType }>();

  const pitchResult = validateNullableCode(
    body.pitchCode,
    "pitchCode",
    resourcesByCode,
    PITCH_HALL_TYPES,
    event.pitchCode,
  );
  if (!pitchResult.ok) return NextResponse.json({ error: pitchResult.error }, { status: 400 });

  const homeResult = validateNullableCode(
    body.homeDressingRoomCode,
    "homeDressingRoomCode",
    resourcesByCode,
    DRESSING_ROOM_TYPES,
    event.homeDressingRoomCode,
  );
  if (!homeResult.ok) return NextResponse.json({ error: homeResult.error }, { status: 400 });

  const awayResult = validateNullableCode(
    body.awayDressingRoomCode,
    "awayDressingRoomCode",
    resourcesByCode,
    DRESSING_ROOM_TYPES,
    event.awayDressingRoomCode,
  );
  if (!awayResult.ok) return NextResponse.json({ error: awayResult.error }, { status: 400 });

  const planId = typeof body.planId === "string" && body.planId.trim() ? body.planId.trim() : null;

  if (planId && tenantId) {
    try {
      const plan = await getWochenplanPlan(tenantId, planId);
      if (!plan.isDefault) {
        const allocation = await upsertWochenplanPlanAllocation(tenantId, {
          wochenplanPlanId: planId,
          eventId,
          pitchCode: pitchResult.value,
          homeDressingRoomCode: homeResult.value,
          awayDressingRoomCode: awayResult.value,
        });
        return NextResponse.json({
          event: {
            id: eventId,
            pitchCode: allocation.pitchCode,
            homeDressingRoomCode: allocation.homeDressingRoomCode,
            awayDressingRoomCode: allocation.awayDressingRoomCode,
          },
          planId,
        });
      }
    } catch (err) {
      if (err instanceof WochenplanPlanNotFoundError) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      if (err instanceof WochenplanPlanValidationError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      if (err instanceof WochenplanPlanAllocationEventNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId, tenantId },
    data: {
      pitchCode: pitchResult.value,
      homeDressingRoomCode: homeResult.value,
      awayDressingRoomCode: awayResult.value,
    },
    select: {
      id: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
    },
  });

  return NextResponse.json({ event: updated });
}
