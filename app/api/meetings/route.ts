import { NextRequest, NextResponse } from "next/server";
import { MeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { listMeetings } from "@/lib/meetings/queries";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

const VALID_MEETING_STATUSES = new Set<string>(Object.values(MeetingStatus));

function parseMeetingStatus(value?: string | null): MeetingStatus | undefined {
  if (!value || !VALID_MEETING_STATUSES.has(value)) return undefined;
  return value as MeetingStatus;
}

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.MEETINGS_READ);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { searchParams } = new URL(request.url);

    const meetings = await listMeetings({
      status: searchParams.get("status") ?? undefined,
      seasonId: searchParams.get("seasonId") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      orgUnitLabel: searchParams.get("orgUnitLabel") ?? undefined,
    });

    return NextResponse.json({ meetings });
  } catch (error) {
    console.error("GET /api/meetings failed:", error);
    return NextResponse.json(
      { error: "Meetings konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.MEETINGS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    const rawDate = body.scheduledAt;
    const scheduledAt = rawDate ? new Date(String(rawDate)) : null;

    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    if (!scheduledAt || isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: "Datum (scheduledAt) ist erforderlich und muss ein gültiges ISO-Datum sein." },
        { status: 400 },
      );
    }

    const description = body.description ? String(body.description).trim() || null : null;
    const location = body.location ? String(body.location).trim() || null : null;
    const onlineMeetingUrl = body.onlineMeetingUrl
      ? String(body.onlineMeetingUrl).trim() || null
      : null;
    const orgUnitLabel = body.orgUnitLabel ? String(body.orgUnitLabel).trim() || null : null;
    const seasonId = body.seasonId ? String(body.seasonId) : null;
    const teamId = body.teamId ? String(body.teamId) : null;
    const status = parseMeetingStatus(body.status) ?? MeetingStatus.DRAFT;

    const meeting = await prisma.meeting.create({
      data: {
        // TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with tenant from session
        tenantSlug: ACTIVE_TENANT_SLUG,
        title,
        scheduledAt,
        description,
        location,
        onlineMeetingUrl,
        orgUnitLabel,
        seasonId,
        teamId,
        status,
        createdByUserId: access.session?.user?.id ?? null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        orgUnitLabel: true,
        location: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    console.error("POST /api/meetings failed:", error);
    return NextResponse.json(
      { error: "Meeting konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
