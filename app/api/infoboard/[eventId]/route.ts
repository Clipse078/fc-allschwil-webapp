/**
 * PATCH /api/infoboard/[eventId]
 *
 * Sets infoboardVisible on a single event.
 * Body: { infoboardVisible: boolean }
 *
 * Permission: INFOBOARD_MANAGE or EVENTS_PUBLISH_INFOBOARD
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.infoboardVisible !== "boolean") {
    return NextResponse.json(
      { error: "infoboardVisible muss ein Boolean sein." },
      { status: 400 },
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { infoboardVisible: body.infoboardVisible },
    select: {
      id: true,
      title: true,
      infoboardVisible: true,
      startAt: true,
      type: true,
      status: true,
    },
  });

  return NextResponse.json({ event: updated });
}
