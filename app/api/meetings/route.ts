import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingStatus } from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { getMeetings } from "@/lib/meetings/queries";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const actor = buildActorContext(check.session.user);
  const meetings = await getMeetings(actor);
  return NextResponse.json({ meetings });
}

export async function POST(request: NextRequest) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

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

    const existing = await prisma.meeting.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: `Slug "${slug}" ist bereits vergeben.` }, { status: 409 });
    }

    const validStatuses = Object.values(MeetingStatus);
    const status: MeetingStatus = validStatuses.includes(body?.status as MeetingStatus)
      ? (body.status as MeetingStatus)
      : MeetingStatus.PLANNED;

    const created = await prisma.meeting.create({
      data: {
        slug,
        title,
        description: body?.description?.trim() || null,
        meetingDate,
        location: body?.location?.trim() || null,
        attendeeCount: body?.attendeeCount ? Number(body.attendeeCount) : null,
        status,
        createdByUserId: check.session.user.id,
      },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ meeting: created }, { status: 201 });
  } catch (error) {
    console.error("Create meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht erstellt werden." }, { status: 500 });
  }
}
