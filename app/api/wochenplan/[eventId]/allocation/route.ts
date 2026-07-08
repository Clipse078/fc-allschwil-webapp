/**
 * PATCH /api/wochenplan/[eventId]/allocation
 *
 * Persists pitch and dressing-room allocation for a single event.
 * Body: {
 *   pitchCode: string | null,
 *   homeDressingRoomCode: string | null,
 *   awayDressingRoomCode: string | null,
 *   startAt?: string,
 *   endAt?: string,
 *   location?: string | null
 * }
 *
 * Permission: WOCHENPLAN_MANAGE or EVENTS_MANAGE
 * Tenant isolation: only events belonging to the actor's tenant can be modified.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { FCA_PITCH_ALLOCATIONS } from "@/lib/facilities/pitches";
import { FCA_DRESSING_ROOMS } from "@/lib/facilities/dressing-rooms";
import { assertEventBelongsToTenant } from "@/lib/weekly-plan/tenant-validation";

type RouteContext = { params: Promise<{ eventId: string }> };

const VALID_PITCH_CODES = new Set(FCA_PITCH_ALLOCATIONS.map((p) => p.code));
const VALID_ROOM_CODES = new Set(FCA_DRESSING_ROOMS.map((r) => r.code));

function toOptionalDate(value: unknown, field: string): { ok: true; value?: Date } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };

  if (value === null) {
    return { ok: false, error: `${field} darf nicht null sein.` };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} muss ein ISO-Datum sein.` };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `Ungültiges Datum für ${field}.` };
  }

  return { ok: true, value: date };
}

function toOptionalNullableString(value: unknown, field: string): { ok: true; value?: string | null } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${field} muss ein String oder null sein.` };

  const trimmed = value.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

function validateNullableCode(value: unknown, valid: Set<string>, field: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${field} muss ein String oder null sein.` };
  if (!valid.has(value)) return { ok: false, error: `UngÃ¼ltiger ${field}: ${value}` };
  return { ok: true, value };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.WOCHENPLAN_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const actorTenantId = access.session?.user?.tenantId ?? null;

  // Reject actors without tenant context before any DB query or update.
  if (!actorTenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));

  const pitchResult = validateNullableCode(body.pitchCode, VALID_PITCH_CODES, "pitchCode");
  if (!pitchResult.ok) return NextResponse.json({ error: pitchResult.error }, { status: 400 });

  const homeResult = validateNullableCode(body.homeDressingRoomCode, VALID_ROOM_CODES, "homeDressingRoomCode");
  if (!homeResult.ok) return NextResponse.json({ error: homeResult.error }, { status: 400 });

  const awayResult = validateNullableCode(body.awayDressingRoomCode, VALID_ROOM_CODES, "awayDressingRoomCode");
  if (!awayResult.ok) return NextResponse.json({ error: awayResult.error }, { status: 400 });

  const startAtResult = toOptionalDate(body.startAt, "startAt");
  if (!startAtResult.ok) return NextResponse.json({ error: startAtResult.error }, { status: 400 });

  const endAtResult = toOptionalDate(body.endAt, "endAt");
  if (!endAtResult.ok) return NextResponse.json({ error: endAtResult.error }, { status: 400 });

  const locationResult = toOptionalNullableString(body.location, "location");
  if (!locationResult.ok) return NextResponse.json({ error: locationResult.error }, { status: 400 });

  if (
    startAtResult.value instanceof Date &&
    endAtResult.value instanceof Date &&
    endAtResult.value.getTime() < startAtResult.value.getTime()
  ) {
    return NextResponse.json({ error: "Endzeit darf nicht vor Startzeit liegen." }, { status: 400 });
  }

  const placementData: {
    startAt?: Date;
    endAt?: Date;
    location?: string | null;
  } = {};

  if ("value" in startAtResult) placementData.startAt = startAtResult.value;
  if ("value" in endAtResult) placementData.endAt = endAtResult.value;
  if ("value" in locationResult) placementData.location = locationResult.value;

  // Verify event ownership before any write. All failure modes (not found,
  // tenantless event, event belonging to another tenant) return the same
  // safe response to avoid leaking cross-tenant existence information.
  try {
    await assertEventBelongsToTenant(eventId, actorTenantId);
  } catch {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  // Defence-in-depth: the write itself also constrains by tenantId so that
  // a concurrent tenant reassignment cannot slip through between validation
  // and the update.
  const updatedEvents = await prisma.event.updateManyAndReturn({
    where: { id: eventId, tenantId: actorTenantId },
    data: {
      pitchCode: pitchResult.value,
      homeDressingRoomCode: homeResult.value,
      awayDressingRoomCode: awayResult.value,
      ...placementData,
    },
    select: {
      id: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
      startAt: true,
      endAt: true,
      location: true,
    },
  });

  if (updatedEvents.length === 0) {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ event: updatedEvents[0] });
}
