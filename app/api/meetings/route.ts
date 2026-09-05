import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MeetingStatus, VisibilityScope } from "@prisma/client";
import { getMeetings } from "@/lib/meetings/queries";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireStrategicApiContext } from "@/lib/permissions/require-strategic-api-context";

export async function GET() {
  const access = await requireStrategicApiContext([
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.MEETINGS_MANAGE,
  ]);
  if (!access.ok) return access.response;
  const meetings = await getMeetings(access.context.actor);
  return NextResponse.json({ meetings });
}

export async function POST(request: NextRequest) {
  const access = await requireStrategicApiContext([PERMISSIONS.MEETINGS_MANAGE]);
  if (!access.ok) return access.response;
  const { actor, tenantId } = access.context;

  try {
    const body = await request.json().catch(() => ({}));

    const title = (body?.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    const rawDate = body?.meetingDate;
    if (!rawDate) {
      return NextResponse.json({ error: "Datum ist erforderlich." }, { status: 400 });
    }

    const meetingDate = new Date(rawDate);
    if (isNaN(meetingDate.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
    }

    const rawSlug = (body?.slug ?? "").trim();
    const slug = rawSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const existing = await prisma.meeting.findFirst({
      where: { slug, tenantId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" ist bereits vergeben.` }, { status: 409 });
    }

    const validStatuses = Object.values(MeetingStatus);
    const status: MeetingStatus = validStatuses.includes(body?.status as MeetingStatus)
      ? (body.status as MeetingStatus)
      : MeetingStatus.PLANNED;

    const validScopes = Object.values(VisibilityScope);
    const visibilityScope: VisibilityScope = validScopes.includes(body?.visibilityScope as VisibilityScope)
      ? (body.visibilityScope as VisibilityScope)
      : VisibilityScope.ORGANISATION;

    const created = await prisma.meeting.create({
      data: {
        tenantId,
        slug,
        title,
        description: body?.description?.trim() || null,
        meetingDate,
        location: body?.location?.trim() || null,
        attendeeCount: body?.attendeeCount ? Number(body.attendeeCount) : null,
        status,
        visibilityScope,
        createdByUserId: actor.userId,
        visibleOrgUnitRefs: Array.isArray(body?.visibleOrgUnitRefs) ? body.visibleOrgUnitRefs : undefined,
        visibleRoleRefs: Array.isArray(body?.visibleRoleRefs) ? body.visibleRoleRefs : undefined,
        visibleUserRefs: Array.isArray(body?.visibleUserRefs) ? body.visibleUserRefs : undefined,
        // Phase D: target group refs for resolved-member visibility
        visibleTargetGroupRefs: Array.isArray(body?.visibleTargetGroupRefs) ? body.visibleTargetGroupRefs : undefined,
      },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ meeting: created }, { status: 201 });
  } catch (error) {
    console.error("Create meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht erstellt werden." }, { status: 500 });
  }
}
