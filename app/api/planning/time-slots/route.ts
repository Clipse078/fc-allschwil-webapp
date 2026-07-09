import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import {
  createPlanningTimeSlot,
  getPlanningTimeSlotsForTenant,
  isUniqueConstraintError,
} from "@/lib/planning/time-slots";

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

export async function GET() {
  const access = await requireApiAnyPermission([PERMISSIONS.WOCHENPLAN_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required." }, { status: 403 });
  }

  const timeSlots = await getPlanningTimeSlotsForTenant(tenantId);

  return NextResponse.json({ timeSlots });
}

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission([PERMISSIONS.WOCHENPLAN_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body required." }, { status: 400 });
  }

  if (typeof body.key !== "string" || !body.key.trim()) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }

  if (typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "label is required." }, { status: 400 });
  }

  const startHour = parseInteger(body.startHour, "startHour", 0, 23);
  if (!startHour.ok) {
    return NextResponse.json({ error: startHour.error }, { status: 400 });
  }

  const startMinute = parseInteger(body.startMinute, "startMinute", 0, 59);
  if (!startMinute.ok) {
    return NextResponse.json({ error: startMinute.error }, { status: 400 });
  }

  const endHour = parseInteger(body.endHour, "endHour", 0, 23);
  if (!endHour.ok) {
    return NextResponse.json({ error: endHour.error }, { status: 400 });
  }

  const endMinute = parseInteger(body.endMinute, "endMinute", 0, 59);
  if (!endMinute.ok) {
    return NextResponse.json({ error: endMinute.error }, { status: 400 });
  }

  if (!validateTimeRange(startHour.value, startMinute.value, endHour.value, endMinute.value)) {
    return NextResponse.json({ error: "end time must be after start time." }, { status: 400 });
  }

  const sortOrder = body.sortOrder === undefined ? 0 : body.sortOrder;
  if (!Number.isInteger(sortOrder)) {
    return NextResponse.json({ error: "sortOrder must be an integer." }, { status: 400 });
  }

  const isActive = body.isActive === undefined ? true : body.isActive;
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
  }

  try {
    const timeSlot = await createPlanningTimeSlot({
      tenantId,
      key: body.key.trim(),
      label: body.label.trim(),
      startHour: startHour.value,
      startMinute: startMinute.value,
      endHour: endHour.value,
      endMinute: endMinute.value,
      sortOrder,
      isActive,
    });

    return NextResponse.json({ timeSlot }, { status: 201 });
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
