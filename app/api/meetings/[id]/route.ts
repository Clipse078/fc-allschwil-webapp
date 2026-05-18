import { NextRequest, NextResponse } from "next/server";
import { MeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getMeetingById } from "@/lib/meetings/queries";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_MEETING_STATUSES = new Set<string>(Object.values(MeetingStatus));

function parseMeetingStatus(value?: string | null): MeetingStatus | undefined {
  if (!value || !VALID_MEETING_STATUSES.has(value)) return undefined;
  return value as MeetingStatus;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.MEETINGS_READ);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { id } = await params;
    const meeting = await getMeetingById(id);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error("GET /api/meetings/[id] failed:", error);
    return NextResponse.json(
      { error: "Meeting konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.MEETINGS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { id } = await params;

    const existing = await prisma.meeting.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // Build update payload — only include fields that are explicitly provided.
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: "Titel darf nicht leer sein." }, { status: 400 });
      data.title = title;
    }

    if (body.scheduledAt !== undefined) {
      const scheduledAt = new Date(String(body.scheduledAt));
      if (isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Ungültiges Datum für scheduledAt." }, { status: 400 });
      }
      data.scheduledAt = scheduledAt;
    }

    if (body.status !== undefined) {
      const status = parseMeetingStatus(body.status);
      if (!status) {
        return NextResponse.json(
          { error: `Ungültiger Status. Gültig: ${[...VALID_MEETING_STATUSES].join(", ")}` },
          { status: 400 },
        );
      }
      data.status = status;
    }

    if (body.description !== undefined) data.description = body.description || null;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.onlineMeetingUrl !== undefined) data.onlineMeetingUrl = body.onlineMeetingUrl || null;
    if (body.orgUnitLabel !== undefined) data.orgUnitLabel = body.orgUnitLabel || null;
    if (body.minutesBody !== undefined) data.minutesBody = body.minutesBody || null;

    data.updatedByUserId = access.session?.user?.id ?? null;

    const meeting = await prisma.meeting.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        orgUnitLabel: true,
        location: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ meeting });
  } catch (error) {
    console.error("PATCH /api/meetings/[id] failed:", error);
    return NextResponse.json(
      { error: "Meeting konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
