/**
 * PATCH /api/wochenplan/[eventId]/allocation
 *
 * Persists pitch and dressing-room allocation for a single event.
 * Body: { pitchCode: string | null, homeDressingRoomCode: string | null, awayDressingRoomCode: string | null }
 *
 * Permission: WOCHENPLAN_MANAGE or EVENTS_MANAGE
 * Tenant isolation: only events belonging to the actor's tenant can be modified.
 *
 * MASTERDATA-CONSISTENCY-02: pitch/room codes are validated against the
 * canonical, tenant-scoped, active (non-archived) FacilityResource table —
 * not the static FCA_PITCH_ALLOCATIONS / FCA_DRESSING_ROOMS registries. The
 * validation tenant is always derived server-side (the event's own tenantId,
 * falling back to the actor's active tenant for legacy tenant-less events) —
 * the client never supplies or influences tenant identity.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveFacilityResourcesByCodesForTenant } from "@/lib/facilities/queries";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";

type RouteContext = { params: Promise<{ eventId: string }> };

type ActiveResourceByCode = Map<string, { type: string }>;

function validateNullableCode(
  value: unknown,
  activeResourcesByCode: ActiveResourceByCode,
  allowedGroup: "PITCH_HALL" | "DRESSING_ROOM",
  field: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${field} muss ein String oder null sein.` };

  const resource = activeResourcesByCode.get(value);
  if (!resource || classifyFacilityResourceType(resource.type) !== allowedGroup) {
    return { ok: false, error: `Ungültiger ${field}: ${value}` };
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

  // The event's own tenant is authoritative for canonical resource validation;
  // only a legacy tenant-less event falls back to the actor's active tenant.
  const validationTenantId = event.tenantId ?? actorTenantId;

  const requestedCodes = [
    body.pitchCode,
    body.homeDressingRoomCode,
    body.awayDressingRoomCode,
  ].filter((c): c is string => typeof c === "string");

  if (requestedCodes.length > 0 && !validationTenantId) {
    return NextResponse.json(
      { error: "Tenant-Kontext fehlt für die Ressourcenvalidierung." },
      { status: 400 },
    );
  }

  const activeResourcesByCode = validationTenantId
    ? await getActiveFacilityResourcesByCodesForTenant(requestedCodes, validationTenantId)
    : new Map();

  const pitchResult = validateNullableCode(body.pitchCode, activeResourcesByCode, "PITCH_HALL", "pitchCode");
  if (!pitchResult.ok) return NextResponse.json({ error: pitchResult.error }, { status: 400 });

  const homeResult = validateNullableCode(body.homeDressingRoomCode, activeResourcesByCode, "DRESSING_ROOM", "homeDressingRoomCode");
  if (!homeResult.ok) return NextResponse.json({ error: homeResult.error }, { status: 400 });

  const awayResult = validateNullableCode(body.awayDressingRoomCode, activeResourcesByCode, "DRESSING_ROOM", "awayDressingRoomCode");
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
