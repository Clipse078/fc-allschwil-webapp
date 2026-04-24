import { NextResponse } from "next/server";
import { PlanningAllocationMode, PlanningResourceType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

type PublishEventPayload = {
  id: string;
  startAt: string;
  endAt: string | null;
  eventType: string;
  pitchRowKey: string;
  fieldLabel: "A" | "B" | null;
};

function getPitchResourceKey(event: PublishEventPayload) {
  const suffix = event.fieldLabel === "B" ? "feld-b" : "feld-a";

  if (event.pitchRowKey === "KUNSTRASEN_2") return `kunstrasen-2-${suffix}`;
  if (event.pitchRowKey === "KUNSTRASEN_3") return `kunstrasen-3-${suffix}`;
  return `stadion-${suffix}`;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const events = Array.isArray(body?.events)
    ? (body.events.filter(
        (event: unknown): event is PublishEventPayload =>
          typeof event === "object" &&
          event !== null &&
          typeof (event as PublishEventPayload).id === "string" &&
          typeof (event as PublishEventPayload).startAt === "string" &&
          typeof (event as PublishEventPayload).pitchRowKey === "string",
      ) as PublishEventPayload[])
    : [];

  if (events.length === 0) {
    return NextResponse.json(
      { error: "Keine Wochenplan-Einträge zum Publizieren erhalten." },
      { status: 400 },
    );
  }

  const resources = await prisma.planningResource.findMany({
    where: {
      type: PlanningResourceType.PITCH,
      key: {
        in: Array.from(new Set(events.map(getPitchResourceKey))),
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  const resourceByKey = new Map(resources.map((resource) => [resource.key, resource]));

  const missingResources = events
    .map(getPitchResourceKey)
    .filter((key) => !resourceByKey.has(key));

  if (missingResources.length > 0) {
    return NextResponse.json(
      { error: `Platz-Ressource fehlt: ${Array.from(new Set(missingResources)).join(", ")}` },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    events.map((event) => {
      const pitchResourceKey = getPitchResourceKey(event);
      const pitchResource = resourceByKey.get(pitchResourceKey);

      if (!pitchResource) {
        throw new Error(`Missing pitch resource ${pitchResourceKey}`);
      }

      return prisma.event.update({
        where: { id: event.id },
        data: {
          startAt: new Date(event.startAt),
          endAt: event.endAt ? new Date(event.endAt) : null,
          wochenplanVisible: true,
          websiteVisible: true,
          infoboardVisible: true,
          reviewStage: "PUBLISHED",
          publishedAt: new Date(),
          publishedByUserId: session.user.id,
          planningAllocations: {
            upsert: {
              where: {
                eventId_resourceId: {
                  eventId: event.id,
                  resourceId: pitchResource.id,
                },
              },
              create: {
                resourceId: pitchResource.id,
                mode:
                  event.eventType === "TRAINING"
                    ? PlanningAllocationMode.HALF_PITCH
                    : PlanningAllocationMode.FULL_PITCH,
                startsAt: new Date(event.startAt),
                endsAt: event.endAt ? new Date(event.endAt) : null,
                label: "Platz",
              },
              update: {
                mode:
                  event.eventType === "TRAINING"
                    ? PlanningAllocationMode.HALF_PITCH
                    : PlanningAllocationMode.FULL_PITCH,
                startsAt: new Date(event.startAt),
                endsAt: event.endAt ? new Date(event.endAt) : null,
                label: "Platz",
              },
            },
          },
        },
      });
    }),
  );

  return NextResponse.json({
    publishedCount: events.length,
  });
}
