import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import {
  getPlanningTimeSlotForTenant,
  isUniqueConstraintError,
  updatePlanningTimeSlot,
  type UpdatePlanningTimeSlotInput,
} from "@/lib/planning/time-slots";

type RouteContext = { params: Promise<{ slotId: string }> };

function parseInteger(value: unknown, field: string, min: number, max: number) {
  if (!Number.isInteger(value) || typeof value !== "number" || value < min || value > max) {
    return { ok: false as const, error: `${field} must be an integer between ${min} and ${max}.` };
  }

  return { ok: true as const, value };
}

function validateTimeRange(startHour: number, startMinute: number, endHour: number, endMinute: number) {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;

  return end > start;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.WOCHENPLAN_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required." }, { status: 403 });
  }

  const { slotId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required." }, { status: 400 });
  }

  const existing = await getPlanningTimeSlotForTenant(slotId, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Planning time slot not found." }, { status: 404 });
  }

  const data: UpdatePlanningTimeSlotInput = {};

  if ("key" in body) {
    if (typeof body.key !== "string" || !body.key.trim()) {
      return NextResponse.json({ error: "key must be a non-empty string." }, { status: 400 });
    }
    data.key = body.key.trim();
  }

  if ("label" in body) {
    if (typeof body.label !== "string" || !body.label.trim()) {
      return NextResponse.json({ error: "label must be a non-empty string." }, { status: 400 });
    }
    data.label = body.label.trim();
  }

  for (const field of ["startHour", "startMinute", "endHour", "endMinute"] as const) {
    if (field in body) {
      const max = field.endsWith("Hour") ? 23 : 59;
      const parsed = parseInteger(body[field], field, 0, max);

      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      data[field] = parsed.value;
    }
  }

  if ("sortOrder" in body) {
    if (!Number.isInteger(body.sortOrder)) {
      return NextResponse.json({ error: "sortOrder must be an integer." }, { status: 400 });
    }
    data.sortOrder = body.sortOrder;
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const nextStartHour = data.startHour ?? existing.startHour;
  const nextStartMinute = data.startMinute ?? existing.startMinute;
  const nextEndHour = data.endHour ?? existing.endHour;
  const nextEndMinute = data.endMinute ?? existing.endMinute;

  if (!validateTimeRange(nextStartHour, nextStartMinute, nextEndHour, nextEndMinute)) {
    return NextResponse.json({ error: "end time must be after start time." }, { status: 400 });
  }

  try {
    const timeSlot = await updatePlanningTimeSlot(slotId, tenantId, data);

    if (!timeSlot) {
      return NextResponse.json({ error: "Planning time slot not found." }, { status: 404 });
    }

    return NextResponse.json({ timeSlot });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "A planning time slot with this key already exists for this tenant." },
        { status: 409 },
      );
    }

    throw error;
  }
}
