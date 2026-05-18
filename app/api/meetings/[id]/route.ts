import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingStatus } from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      meetingDate: true,
      location: true,
      attendeeCount: true,
      status: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const existing = await prisma.meeting.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const validStatuses = Object.values(MeetingStatus);

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: body?.title?.trim() || undefined,
        description: body?.description?.trim() || null,
        meetingDate: body?.meetingDate ? new Date(body.meetingDate) : undefined,
        location: body?.location?.trim() || null,
        attendeeCount: body?.attendeeCount !== undefined ? Number(body.attendeeCount) || null : undefined,
        status: validStatuses.includes(body?.status as MeetingStatus)
          ? (body.status as MeetingStatus)
          : undefined,
        requiresFourEyeReview:
          typeof body?.requiresFourEyeReview === "boolean"
            ? body.requiresFourEyeReview
            : undefined,
      },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("Update meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const existing = await prisma.meeting.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
  }

  try {
    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ message: "Meeting wurde gelöscht." });
  } catch (error) {
    console.error("Delete meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht gelöscht werden." }, { status: 500 });
  }
}
