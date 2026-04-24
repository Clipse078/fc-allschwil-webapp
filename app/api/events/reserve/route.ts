import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const {
    title,
    type,
    teamId,
    opponentName,
    startAt,
    endAt,
    pitchResourceKey,
    dressingRoomHomeKey,
    dressingRoomAwayKey,
    seasonId,
  } = body;

  if (!title || !type || !startAt || !pitchResourceKey) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const season =
    seasonId
      ? await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } })
      : await prisma.season.findFirst({
          where: { isActive: true },
          select: { id: true },
        });

  if (!season) {
    return NextResponse.json(
      { error: "Keine aktive Saison gefunden." },
      { status: 400 },
    );
  }

  // create event in SUBMITTED state (not published)
  const event = await prisma.event.create({
    data: {
      seasonId: season.id,
      title,
      type,
      source: "MANUAL",
      status: "SCHEDULED",
      reviewStage: "SUBMITTED",
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      teamId: teamId ?? null,
      opponentName: opponentName ?? null,
      wochenplanVisible: true,
      websiteVisible: false,
      infoboardVisible: false,
      createdByUserId: session.user.id,
    },
  });

  // attach pitch allocation
  if (pitchResourceKey) {
    const pitch = await prisma.planningResource.findUnique({
      where: { key: pitchResourceKey },
    });

    if (pitch) {
      await prisma.eventPlanningAllocation.create({
        data: {
          eventId: event.id,
          resourceId: pitch.id,
        },
      });
    }
  }

  // home dressing room
  if (dressingRoomHomeKey) {
    const room = await prisma.planningResource.findUnique({
      where: { key: dressingRoomHomeKey },
    });

    if (room) {
      await prisma.eventPlanningAllocation.create({
        data: {
          eventId: event.id,
          resourceId: room.id,
          label: "Heim",
        },
      });
    }
  }

  // away dressing room
  if (dressingRoomAwayKey) {
    const room = await prisma.planningResource.findUnique({
      where: { key: dressingRoomAwayKey },
    });

    if (room) {
      await prisma.eventPlanningAllocation.create({
        data: {
          eventId: event.id,
          resourceId: room.id,
          label: "Gegner",
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    eventId: event.id,
  });
}


