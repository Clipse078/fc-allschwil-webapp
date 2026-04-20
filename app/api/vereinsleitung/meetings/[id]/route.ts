import { Prisma, type VereinsleitungMeetingParticipantStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { slugifyMeetingTitle } from "@/lib/vereinsleitung/meeting-utils";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ParticipantInput = {
  personId: string | null;
  displayName: string;
  roleLabel: string | null;
  status: VereinsleitungMeetingParticipantStatus;
  remarks: string | null;
  sortOrder: number;
};

function getActorUserId(
  access:
    | {
        session?: {
          user?: {
            id?: string | null;
            effectiveUserId?: string | null;
          } | null;
        } | null;
      }
    | null
    | undefined,
) {
  return access?.session?.user?.effectiveUserId ?? access?.session?.user?.id ?? null;
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeDateTime(value: unknown, fieldLabel: string) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return { error: fieldLabel + " ist erforderlich." } as const;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return { error: fieldLabel + " ist ungueltig." } as const;
  }

  return { value: parsed } as const;
}

function normalizeOptionalDateTime(value: unknown, fieldLabel: string) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return { value: null } as const;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return { error: fieldLabel + " ist ungueltig." } as const;
  }

  return { value: parsed } as const;
}

function normalizeMatterIds(value: unknown) {
  if (value === undefined) {
    return { value: undefined } as const;
  }

  if (!Array.isArray(value)) {
    return { error: "matterIds muss ein Array sein." } as const;
  }

  const matterIds = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return { value: Array.from(new Set(matterIds)) } as const;
}

function parseParticipantStatus(
  value: unknown,
): { value: VereinsleitungMeetingParticipantStatus } | { error: string } {
  const status = String(value ?? "INVITED").trim().toUpperCase();

  switch (status) {
    case "INVITED":
      return { value: "INVITED" };
    case "CONFIRMED":
      return { value: "CONFIRMED" };
    case "EXCUSED":
      return { value: "EXCUSED" };
    case "ABSENT":
      return { value: "ABSENT" };
    default:
      return { error: "Ungueltiger Teilnehmerstatus: " + status };
  }
}

function normalizeParticipants(value: unknown) {
  if (value === undefined) {
    return { value: undefined } as const;
  }

  if (!Array.isArray(value)) {
    return { error: "participants muss ein Array sein." } as const;
  }

  const participants: ParticipantInput[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const displayName = String(record.displayName ?? "").trim();
    const personId = String(record.personId ?? "").trim();
    const roleLabel = String(record.roleLabel ?? "").trim();
    const remarks = String(record.remarks ?? "").trim();
    const statusResult = parseParticipantStatus(record.status);

    if (!displayName) {
      return { error: "Jeder Teilnehmer braucht einen Namen." } as const;
    }

    if ("error" in statusResult) {
      return { error: statusResult.error } as const;
    }

    participants.push({
      personId: personId || null,
      displayName,
      roleLabel: roleLabel || null,
      status: statusResult.value,
      remarks: remarks || null,
      sortOrder: index,
    });
  }

  return { value: participants } as const;
}

async function validateMatterIds(matterIds: string[]) {
  if (matterIds.length === 0) {
    return { matters: [] } as const;
  }

  const matters = await prisma.vereinsleitungMatter.findMany({
    where: {
      id: {
        in: matterIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (matters.length !== matterIds.length) {
    return { error: "Mindestens eine verknuepfte Pendenz wurde nicht gefunden." } as const;
  }

  return { matters } as const;
}

async function validateParticipantPersonIds(
  participants: {
    personId: string | null;
  }[],
) {
  const personIds = participants
    .map((participant) => participant.personId)
    .filter((personId): personId is string => Boolean(personId));

  if (personIds.length === 0) {
    return { ok: true } as const;
  }

  const uniquePersonIds = Array.from(new Set(personIds));

  const people = await prisma.person.findMany({
    where: {
      id: {
        in: uniquePersonIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (people.length !== uniquePersonIds.length) {
    return {
      ok: false,
      error: "Mindestens ein Teilnehmer verweist auf eine unbekannte Person.",
    } as const;
  }

  return { ok: true } as const;
}

async function buildUniqueMeetingSlug(title: string, excludeMeetingId?: string) {
  const baseSlug = slugifyMeetingTitle(title) || "meeting";
  const existing = await prisma.vereinsleitungMeeting.findMany({
    where: excludeMeetingId
      ? {
          id: { not: excludeMeetingId },
          slug: {
            startsWith: baseSlug,
          },
        }
      : {
          slug: {
            startsWith: baseSlug,
          },
        },
    select: {
      slug: true,
    },
  });

  if (existing.length === 0) {
    return baseSlug;
  }

  const taken = new Set(existing.map((item) => item.slug));

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;

  while (taken.has(baseSlug + "-" + counter)) {
    counter += 1;
  }

  return baseSlug + "-" + counter;
}

async function getMeeting(id: string) {
  return prisma.vereinsleitungMeeting.findUnique({
    where: { id },
    include: {
      matterLinks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          matter: {
            include: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          carriedOverFromMeeting: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      participants: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireApiAnyPermission(
    ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const params = await context.params;
  const meeting = await getMeeting(params.id);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const params = await context.params;
  const meetingId = params.id;

  try {
    const existingMeeting = await getMeeting(meetingId);

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      title?: string;
      slug?: string;
      subtitle?: string | null;
      description?: string | null;
      location?: string | null;
      onlineMeetingUrl?: string | null;
      status?: string;
      notes?: string | null;
      startAt?: Date;
      endAt?: Date | null;
      carryOverSourceMeetingId?: string | null;
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();

      if (!title) {
        return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
      }

      data.title = title;
      data.slug =
        title === existingMeeting.title
          ? existingMeeting.slug
          : await buildUniqueMeetingSlug(title, meetingId);
    }

    if (body.subtitle !== undefined) {
      data.subtitle = normalizeOptionalString(body.subtitle);
    }

    if (body.description !== undefined) {
      data.description = normalizeOptionalString(body.description);
    }

    if (body.location !== undefined) {
      data.location = normalizeOptionalString(body.location);
    }

    if (body.onlineMeetingUrl !== undefined) {
      data.onlineMeetingUrl = normalizeOptionalString(body.onlineMeetingUrl);
    }

    if (body.status !== undefined) {
      data.status = String(body.status ?? "").trim().toUpperCase() || "PLANNED";
    }

    if (body.notes !== undefined) {
      data.notes = normalizeOptionalString(body.notes);
    }

    if (body.startAt !== undefined) {
      const startAtResult = normalizeDateTime(body.startAt, "Startzeit");

      if ("error" in startAtResult) {
        return NextResponse.json({ error: startAtResult.error }, { status: 400 });
      }

      data.startAt = startAtResult.value;
    }

    if (body.endAt !== undefined) {
      const endAtResult = normalizeOptionalDateTime(body.endAt, "Endzeit");

      if ("error" in endAtResult) {
        return NextResponse.json({ error: endAtResult.error }, { status: 400 });
      }

      data.endAt = endAtResult.value;
    }

    if (body.carryOverSourceMeetingId !== undefined) {
      data.carryOverSourceMeetingId = normalizeOptionalString(body.carryOverSourceMeetingId);
    }

    const nextStartAt = data.startAt ?? existingMeeting.startAt;
    const nextEndAt = data.endAt === undefined ? existingMeeting.endAt : data.endAt;

    if (nextEndAt && nextEndAt.getTime() < nextStartAt.getTime()) {
      return NextResponse.json(
        { error: "Endzeit darf nicht vor der Startzeit liegen." },
        { status: 400 },
      );
    }

    const matterIdsResult = normalizeMatterIds(body.matterIds);

    if ("error" in matterIdsResult) {
      return NextResponse.json({ error: matterIdsResult.error }, { status: 400 });
    }

    if (matterIdsResult.value !== undefined) {
      const matterValidation = await validateMatterIds(matterIdsResult.value);

      if ("error" in matterValidation) {
        return NextResponse.json({ error: matterValidation.error }, { status: 400 });
      }
    }

    const participantsResult = normalizeParticipants(body.participants);

    if ("error" in participantsResult) {
      return NextResponse.json({ error: participantsResult.error }, { status: 400 });
    }

    if (participantsResult.value !== undefined) {
      const participantValidation = await validateParticipantPersonIds(
        participantsResult.value,
      );

      if (!participantValidation.ok) {
        return NextResponse.json({ error: participantValidation.error }, { status: 400 });
      }
    }

    const updatedMeeting = await prisma.$transaction(async (tx) => {
      if (matterIdsResult.value !== undefined) {
        await tx.vereinsleitungMeetingMatter.deleteMany({
          where: { meetingId },
        });

        if (matterIdsResult.value.length > 0) {
          await tx.vereinsleitungMeetingMatter.createMany({
            data: matterIdsResult.value.map((matterId, index) => ({
              meetingId,
              matterId,
              sortOrder: index,
              carriedOverFromMeetingId:
                data.carryOverSourceMeetingId ?? existingMeeting.carryOverSourceMeetingId,
            })),
          });
        }
      }

      if (participantsResult.value !== undefined) {
        await tx.vereinsleitungMeetingParticipant.deleteMany({
          where: { meetingId },
        });

        if (participantsResult.value.length > 0) {
          const participantCreateData: Prisma.VereinsleitungMeetingParticipantCreateManyInput[] =
            participantsResult.value.map((participant) => ({
              meetingId,
              personId: participant.personId,
              displayName: participant.displayName,
              roleLabel: participant.roleLabel,
              status: participant.status,
              remarks: participant.remarks,
              sortOrder: participant.sortOrder,
            }));

          await tx.vereinsleitungMeetingParticipant.createMany({
            data: participantCreateData,
          });
        }
      }

      await tx.vereinsleitungMeeting.update({
        where: { id: meetingId },
        data,
      });

      return tx.vereinsleitungMeeting.findUnique({
        where: { id: meetingId },
        include: {
          matterLinks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              matter: {
                include: {
                  owner: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      displayName: true,
                    },
                  },
                },
              },
              carriedOverFromMeeting: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          participants: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeeting",
      entityId: meetingId,
      action: "UPDATE",
      beforeJson: existingMeeting,
      afterJson: updatedMeeting,
    });

    return NextResponse.json(updatedMeeting);
  } catch (error) {
    console.error("Update meeting failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Meeting konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const params = await context.params;
  const meetingId = params.id;

  try {
    const existingMeeting = await getMeeting(meetingId);

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
    }

    await prisma.vereinsleitungMeeting.delete({
      where: { id: meetingId },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeeting",
      entityId: meetingId,
      action: "DELETE",
      beforeJson: existingMeeting,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete meeting failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Meeting konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
