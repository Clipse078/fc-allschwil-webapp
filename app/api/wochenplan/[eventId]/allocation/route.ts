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
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveFacilityResourcesByCodesForTenant } from "@/lib/facilities/queries";
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
): CodeValidationResult {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: `${field} muss ein String oder null sein.` };
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

  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, tenantId: true },
  });
  if (!event) return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });

  // Tenant isolation: if the event has a tenantId, it must match the actor's tenant.
  if (event.tenantId && actorTenantId && event.tenantId !== actorTenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Tenant identity for resource validation comes from the trusted Event row
  // (falling back to the actor's session tenant) — never from client input.
  const tenantId = event.tenantId ?? actorTenantId;

  const submittedCodes = [body.pitchCode, body.homeDressingRoomCode, body.awayDressingRoomCode].filter(
    (v): v is string => typeof v === "string",
  );

  const resourcesByCode = tenantId
    ? await getActiveFacilityResourcesByCodesForTenant(submittedCodes, tenantId)
    : new Map<string, { name: string; type: FacilityResourceType }>();

  const pitchResult = validateNullableCode(body.pitchCode, "pitchCode", resourcesByCode, PITCH_HALL_TYPES);
  if (!pitchResult.ok) return NextResponse.json({ error: pitchResult.error }, { status: 400 });

  const homeResult = validateNullableCode(
    body.homeDressingRoomCode,
    "homeDressingRoomCode",
    resourcesByCode,
    DRESSING_ROOM_TYPES,
  );
  if (!homeResult.ok) return NextResponse.json({ error: homeResult.error }, { status: 400 });

  const awayResult = validateNullableCode(
    body.awayDressingRoomCode,
    "awayDressingRoomCode",
    resourcesByCode,
    DRESSING_ROOM_TYPES,
  );
  if (!awayResult.ok) return NextResponse.json({ error: awayResult.error }, { status: 400 });

  const updated = await prisma.event.update({
    where: { id: eventId },
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
