import { NextResponse } from "next/server";
import { EventType, PlanningAllocationMode, PlanningResourceType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && Object.values(EventType).includes(value as EventType);
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const type = isEventType(body?.type) ? body.type : null;
  const teamId = typeof body?.teamId === "string" && body.teamId ? body.teamId : null;
  const opponentName =
    typeof body?.opponentName === "string" && body.opponentName.trim()
      ? body.opponentName.trim()
      : null;
  const organizerName =
    typeof body?.organizerName === "string" && body.organizerName.trim()
      ? body.organizerName.trim()
      : null;
  const startAt = typeof body?.startAt === "string" ? body.startAt : "";
  const endAt = typeof body?.endAt === "string" && body.endAt ? body.endAt : null;
  const seasonId = typeof body?.seasonId === "string" && body.seasonId ? body.seasonId : null;

  const pitchResourceKeys = Array.isArray(body?.pitchResourceKeys)
    ? body.pitchResourceKeys.filter((key: unknown) => typeof key === "string" && key.trim())
    : typeof body?.pitchResourceKey === "string" && body.pitchResourceKey
      ? [body.pitchResourceKey]
      : [];

  const dressingRoomHomeKey =
    typeof body?.dressingRoomHomeKey === "string" && body.dressingRoomHomeKey
      ? body.dressingRoomHomeKey
      : null;
  const dressingRoomAwayKey =
    typeof body?.dressingRoomAwayKey === "string" && body.dressingRoomAwayKey
      ? body.dressingRoomAwayKey
      : null;

  if (!title || !type || !startAt || pitchResourceKeys.length === 0) {
    return NextResponse.json(
      { error: "Titel, Eventtyp, Startzeit und mindestens ein Spielfeld sind Pflicht." },
      { status: 400 },
    );
  }

  const season = seasonId
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

  const pitches = await prisma.planningResource.findMany({
    where: {
      key: { in: pitchResourceKeys },
      isActive: true,
      type: PlanningResourceType.PITCH,
    },
    select: { id: true, key: true },
  });

  if (pitches.length !== new Set(pitchResourceKeys).size) {
    return NextResponse.json(
      { error: "Mindestens ein gewähltes Spielfeld ist nicht verfügbar." },
      { status: 400 },
    );
  }

  const homeRoom = dressingRoomHomeKey
    ? await prisma.planningResource.findFirst({
        where: {
          key: dressingRoomHomeKey,
          isActive: true,
          type: PlanningResourceType.DRESSING_ROOM,
        },
        select: { id: true },
      })
    : null;

  const awayRoom = dressingRoomAwayKey
    ? await prisma.planningResource.findFirst({
        where: {
          key: dressingRoomAwayKey,
          isActive: true,
          type: PlanningResourceType.DRESSING_ROOM,
        },
        select: { id: true },
      })
    : null;

  if (dressingRoomHomeKey && !homeRoom) {
    return NextResponse.json({ error: "Heim-Garderobe ist nicht verfügbar." }, { status: 400 });
  }

  if (dressingRoomAwayKey && !awayRoom) {
    return NextResponse.json({ error: "Gegner-Garderobe ist nicht verfügbar." }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      seasonId: season.id,
      title,
      type,
      source: "MANUAL",
      status: "SCHEDULED",
      reviewStage: "SUBMITTED",
      reviewRequestedAt: new Date(),
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      teamId,
      opponentName,
      organizerName,
      location: "Sportanlage im Brüel",
      wochenplanVisible: true,
      websiteVisible: false,
      infoboardVisible: false,
      createdByUserId: session.user.id,
      planningAllocations: {
        create: [
          ...pitches.map((pitch) => ({
            resourceId: pitch.id,
            mode:
              pitches.length > 1
                ? PlanningAllocationMode.FULL_PITCH
                : PlanningAllocationMode.HALF_PITCH,
            startsAt: new Date(startAt),
            endsAt: endAt ? new Date(endAt) : null,
            label: "Platz",
          })),
          ...(homeRoom
            ? [
                {
                  resourceId: homeRoom.id,
                  mode: PlanningAllocationMode.SINGLE_ROOM,
                  startsAt: new Date(startAt),
                  endsAt: endAt ? new Date(endAt) : null,
                  label: "Heim",
                },
              ]
            : []),
          ...(awayRoom
            ? [
                {
                  resourceId: awayRoom.id,
                  mode: PlanningAllocationMode.SINGLE_ROOM,
                  startsAt: new Date(startAt),
                  endsAt: endAt ? new Date(endAt) : null,
                  label: "Gegner",
                },
              ]
            : []),
        ],
      },
    },
  });

  return NextResponse.json({
    success: true,
    eventId: event.id,
  });
}
