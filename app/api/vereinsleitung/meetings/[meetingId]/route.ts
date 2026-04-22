import { NextResponse } from "next/server";
import {
  VereinsleitungMeetingMode,
  VereinsleitungMeetingProvider,
  VereinsleitungTeamsSyncStatus,
  type VereinsleitungMeetingParticipantStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { slugifyMeetingTitle } from "@/lib/vereinsleitung/meeting-utils";

type ParticipantInput = {
  personId: string | null;
  displayName: string;
  roleLabel: string | null;
  status: VereinsleitungMeetingParticipantStatus;
  remarks: string | null;
  sortOrder: number;
};

type AgendaItemInput = {
  title: string;
  description: string | null;
  sortOrder: number;
};

type ApprovalStatusValue = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

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
    return { error: fieldLabel + " ist ungÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltig." } as const;
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
    return { error: fieldLabel + " ist ungÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltig." } as const;
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

  const uniqueMatterIds = Array.from(new Set(matterIds));

  return { value: uniqueMatterIds } as const;
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
      return { error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltiger Teilnehmerstatus: " + status };
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

function normalizeAgendaItems(value: unknown) {
  if (value === undefined) {
    return { value: undefined } as const;
  }

  if (!Array.isArray(value)) {
    return { error: "agendaItems muss ein Array sein." } as const;
  }

  const agendaItems: AgendaItemInput[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const title = String(record.title ?? "").trim();
    const description = String(record.description ?? "").trim();

    if (!title) {
      continue;
    }

    agendaItems.push({
      title,
      description: description || null,
      sortOrder: index,
    });
  }

  return { value: agendaItems } as const;
}

function parseMeetingMode(
  value: unknown,
): { value: VereinsleitungMeetingMode } | { error: string } {
  const mode = String(value ?? "ON_SITE").trim().toUpperCase();

  switch (mode) {
    case "ON_SITE":
      return { value: "ON_SITE" };
    case "ONLINE":
      return { value: "ONLINE" };
    case "HYBRID":
      return { value: "HYBRID" };
    default:
      return { error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltiger Meeting-Typ: " + mode };
  }
}

function parseMeetingProvider(
  value: unknown,
): { value: VereinsleitungMeetingProvider } | { error: string } {
  const provider = String(value ?? "NONE").trim().toUpperCase();

  switch (provider) {
    case "NONE":
      return { value: "NONE" };
    case "EXTERNAL":
      return { value: "EXTERNAL" };
    case "MICROSOFT_TEAMS":
      return { value: "MICROSOFT_TEAMS" };
    default:
      return { error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltiger Meeting-Provider: " + provider };
  }
}

function parseMeetingStatus(
  value: unknown,
): { value: "PLANNED" | "IN_PROGRESS" | "DONE" } | { error: string } {
  const status = String(value ?? "PLANNED").trim().toUpperCase();

  switch (status) {
    case "PLANNED":
      return { value: "PLANNED" };
    case "IN_PROGRESS":
      return { value: "IN_PROGRESS" };
    case "DONE":
      return { value: "DONE" };
    default:
      return { error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltiger Meeting-Status: " + status };
  }
}

function parseApprovalStatus(
  value: unknown,
): { value: ApprovalStatusValue } | { error: string } {
  const status = String(value ?? "DRAFT").trim().toUpperCase();

  switch (status) {
    case "DRAFT":
      return { value: "DRAFT" };
    case "SUBMITTED":
      return { value: "SUBMITTED" };
    case "APPROVED":
      return { value: "APPROVED" };
    case "REJECTED":
      return { value: "REJECTED" };
    default:
      return { error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltiger Freigabestatus: " + status };
  }
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
    return { error: "Mindestens eine verknÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼pfte Pendenz wurde nicht gefunden." } as const;
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { meetingId } = await context.params;

  try {
    const existingMeeting = await prisma.vereinsleitungMeeting.findUnique({
      where: { id: meetingId },
      include: {
        matterLinks: true,
        participants: true,
        agendaItems: true,
      },
    });

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : null;

    if (!payload) {
      return NextResponse.json({ error: "UngÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼ltige Anfrage." }, { status: 400 });
    }

    if ("status" in payload && Object.keys(payload).length === 1) {
      const statusResult = parseMeetingStatus(payload.status);

      if ("error" in statusResult) {
        return NextResponse.json({ error: statusResult.error }, { status: 400 });
      }

      const updated = await prisma.vereinsleitungMeeting.update({
        where: { id: meetingId },
        data: {
          status: statusResult.value,
        },
      });

      await logAction({
        actorUserId: getActorUserId(access),
        moduleKey: "vereinsleitung",
        entityType: "VereinsleitungMeeting",
        entityId: meetingId,
        action: "STATUS_UPDATE",
        beforeJson: { status: existingMeeting.status },
        afterJson: { status: updated.status },
      });

      return NextResponse.json(updated);
    }

    if ("approvalStatus" in payload) {
      const allowedApprovalKeys = ["approvalStatus", "approvalNotes"];
      const hasOnlyApprovalFields = Object.keys(payload).every((key) =>
        allowedApprovalKeys.includes(key),
      );

      if (!hasOnlyApprovalFields) {
        return NextResponse.json(
          { error: "Freigabestatus darf nur separat aktualisiert werden." },
          { status: 400 },
        );
      }

      const approvalStatusResult = parseApprovalStatus(payload.approvalStatus);

      if ("error" in approvalStatusResult) {
        return NextResponse.json({ error: approvalStatusResult.error }, { status: 400 });
      }

      const permissionKeys = access.session?.user?.permissionKeys ?? [];
      const requiresReviewPermission =
        approvalStatusResult.value === "SUBMITTED" ||
        approvalStatusResult.value === "REJECTED";
      const requiresApprovePermission =
        approvalStatusResult.value === "APPROVED" ||
        approvalStatusResult.value === "DRAFT";

      if (
        requiresReviewPermission &&
        !permissionKeys.includes(PERMISSIONS.VEREINSLEITUNG_MEETINGS_REVIEW)
      ) {
        return NextResponse.json(
          {
            error:
              "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r diesen Freigabeschritt fehlt die Berechtigung vereinsleitung.meetings.review.",
          },
          { status: 403 },
        );
      }

      if (
        requiresApprovePermission &&
        !permissionKeys.includes(PERMISSIONS.VEREINSLEITUNG_MEETINGS_APPROVE)
      ) {
        return NextResponse.json(
          {
            error:
              "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r diesen Freigabeschritt fehlt die Berechtigung vereinsleitung.meetings.approve.",
          },
          { status: 403 },
        );
      }

      const approvalNotes = normalizeOptionalString(payload.approvalNotes);

      if (approvalStatusResult.value === "REJECTED" && !approvalNotes) {
        return NextResponse.json(
          { error: "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¼r eine Ablehnung ist ein Ablehnungsgrund erforderlich." },
          { status: 400 },
        );
      }

      const actorUserId = getActorUserId(access);
      const now = new Date();

      const approvalUpdateData =
        approvalStatusResult.value === "SUBMITTED"
          ? {
              approvalStatus: approvalStatusResult.value,
              approvalNotes: approvalNotes ?? null,
              approvalSubmittedAt: now,
              approvedAt: null,
              rejectedAt: null,
              approvalRequestedByUserId: actorUserId,
              approvedByUserId: null,
              rejectedByUserId: null,
            }
          : approvalStatusResult.value === "APPROVED"
            ? {
                approvalStatus: approvalStatusResult.value,
                approvalNotes: approvalNotes ?? null,
                approvedAt: now,
                rejectedAt: null,
                approvedByUserId: actorUserId,
                rejectedByUserId: null,
              }
            : approvalStatusResult.value === "REJECTED"
              ? {
                  approvalStatus: approvalStatusResult.value,
                  approvalNotes,
                  rejectedAt: now,
                  approvedAt: null,
                  rejectedByUserId: actorUserId,
                  approvedByUserId: null,
                }
              : {
                  approvalStatus: approvalStatusResult.value,
                  approvalNotes: null,
                  approvalSubmittedAt: null,
                  approvedAt: null,
                  rejectedAt: null,
                  approvalRequestedByUserId: null,
                  approvedByUserId: null,
                  rejectedByUserId: null,
                };

      const updated = await prisma.vereinsleitungMeeting.update({
        where: { id: meetingId },
        data: approvalUpdateData,
      });

      await logAction({
        actorUserId,
        moduleKey: "vereinsleitung",
        entityType: "VereinsleitungMeeting",
        entityId: meetingId,
        action: "APPROVAL_STATUS_UPDATE",
        beforeJson: {
          approvalStatus: existingMeeting.approvalStatus,
          approvalNotes: existingMeeting.approvalNotes,
          approvalSubmittedAt: existingMeeting.approvalSubmittedAt,
          approvedAt: existingMeeting.approvedAt,
          rejectedAt: existingMeeting.rejectedAt,
          approvalRequestedByUserId: existingMeeting.approvalRequestedByUserId,
          approvedByUserId: existingMeeting.approvedByUserId,
          rejectedByUserId: existingMeeting.rejectedByUserId,
        },
        afterJson: {
          approvalStatus: updated.approvalStatus,
          approvalNotes: updated.approvalNotes,
          approvalSubmittedAt: updated.approvalSubmittedAt,
          approvedAt: updated.approvedAt,
          rejectedAt: updated.rejectedAt,
          approvalRequestedByUserId: updated.approvalRequestedByUserId,
          approvedByUserId: updated.approvedByUserId,
          rejectedByUserId: updated.rejectedByUserId,
        },
      });

      return NextResponse.json(updated);
    }

    const title = String(payload.title ?? "").trim();
    const subtitle = normalizeOptionalString(payload.subtitle);
    const description = normalizeOptionalString(payload.description);
    const location = normalizeOptionalString(payload.location);
    const meetingModeResult = parseMeetingMode(payload.meetingMode);
    const meetingProviderResult = parseMeetingProvider(payload.meetingProvider);
    const statusResult = parseMeetingStatus(payload.status);
    const externalMeetingUrl = normalizeOptionalString(payload.externalMeetingUrl);
    const carryOverSourceMeetingId = normalizeOptionalString(payload.carryOverSourceMeetingId);
    const startAtResult = normalizeDateTime(payload.startAt, "Startzeit");
    const endAtResult = normalizeOptionalDateTime(payload.endAt, "Endzeit");
    const matterIdsResult = normalizeMatterIds(payload.matterIds);
    const participantsResult = normalizeParticipants(payload.participants);
    const agendaItemsResult = normalizeAgendaItems(payload.agendaItems);

    if (existingMeeting.status === "DONE") {
      return NextResponse.json(
        { error: "Meeting ist abgeschlossen. Vorbereitungsdaten kÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶nnen nicht mehr bearbeitet werden." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    if ("error" in meetingModeResult) {
      return NextResponse.json({ error: meetingModeResult.error }, { status: 400 });
    }

    if ("error" in meetingProviderResult) {
      return NextResponse.json({ error: meetingProviderResult.error }, { status: 400 });
    }

    if ("error" in statusResult) {
      return NextResponse.json({ error: statusResult.error }, { status: 400 });
    }

    if ("error" in startAtResult) {
      return NextResponse.json({ error: startAtResult.error }, { status: 400 });
    }

    if ("error" in endAtResult) {
      return NextResponse.json({ error: endAtResult.error }, { status: 400 });
    }

    if ("error" in matterIdsResult) {
      return NextResponse.json({ error: matterIdsResult.error }, { status: 400 });
    }

    if ("error" in participantsResult) {
      return NextResponse.json({ error: participantsResult.error }, { status: 400 });
    }

    if ("error" in agendaItemsResult) {
      return NextResponse.json({ error: agendaItemsResult.error }, { status: 400 });
    }

    if (endAtResult.value && endAtResult.value.getTime() < startAtResult.value.getTime()) {
      return NextResponse.json(
        { error: "Endzeit darf nicht vor der Startzeit liegen." },
        { status: 400 },
      );
    }

    const meetingMode = meetingModeResult.value;
    const meetingProvider =
      meetingMode === "ON_SITE" ? "NONE" : meetingProviderResult.value;

    if (meetingProvider === "EXTERNAL" && !externalMeetingUrl) {
      return NextResponse.json(
        { error: "Ein externer Meeting-Link ist erforderlich." },
        { status: 400 },
      );
    }

    const matterIds = matterIdsResult.value ?? [];
    const matterValidation = await validateMatterIds(matterIds);

    if ("error" in matterValidation) {
      return NextResponse.json({ error: matterValidation.error }, { status: 400 });
    }

    const participants = participantsResult.value ?? [];
    const participantValidation = await validateParticipantPersonIds(participants);

    if (!participantValidation.ok) {
      return NextResponse.json({ error: participantValidation.error }, { status: 400 });
    }

    const agendaItems = agendaItemsResult.value ?? [];
    const slug =
      title === existingMeeting.title
        ? existingMeeting.slug
        : await buildUniqueMeetingSlug(title, existingMeeting.id);

    const teamsSyncStatus: VereinsleitungTeamsSyncStatus =
      meetingProvider === "MICROSOFT_TEAMS"
        ? existingMeeting.teamsSyncStatus === "CREATED"
          ? "CREATED"
          : "PENDING"
        : meetingProvider === "EXTERNAL"
          ? "MANUAL"
          : "NOT_CONFIGURED";

    const updated = await prisma.$transaction(async (tx) => {
      await tx.vereinsleitungMeetingMatter.deleteMany({
        where: { meetingId },
      });

      await tx.vereinsleitungMeetingParticipant.deleteMany({
        where: { meetingId },
      });

      await tx.vereinsleitungMeetingAgendaItem.deleteMany({
        where: { meetingId },
      });

      return tx.vereinsleitungMeeting.update({
        where: { id: meetingId },
        data: {
          title,
          slug,
          subtitle,
          description,
          location,
          meetingMode,
          meetingProvider,
          externalMeetingUrl: meetingProvider === "EXTERNAL" ? externalMeetingUrl : null,
          onlineMeetingUrl: meetingProvider === "EXTERNAL" ? externalMeetingUrl : null,
          teamsSyncStatus,
          teamsJoinUrl:
            meetingProvider === "MICROSOFT_TEAMS" ? existingMeeting.teamsJoinUrl : null,
          teamsMeetingId:
            meetingProvider === "MICROSOFT_TEAMS" ? existingMeeting.teamsMeetingId : null,
          teamsCalendarEventId:
            meetingProvider === "MICROSOFT_TEAMS" ? existingMeeting.teamsCalendarEventId : null,
          teamsLastSyncedAt:
            meetingProvider === "MICROSOFT_TEAMS" ? existingMeeting.teamsLastSyncedAt : null,
          teamsErrorMessage:
            meetingProvider === "MICROSOFT_TEAMS" ? existingMeeting.teamsErrorMessage : null,
          status: statusResult.value,
          startAt: startAtResult.value,
          endAt: endAtResult.value,
          carryOverSourceMeetingId,
          matterLinks: matterIds.length
            ? {
                create: matterIds.map((matterId, index) => ({
                  matterId,
                  sortOrder: index,
                  carriedOverFromMeetingId: carryOverSourceMeetingId,
                })),
              }
            : undefined,
          participants: participants.length
            ? {
                create: participants.map((participant) => ({
                  personId: participant.personId,
                  displayName: participant.displayName,
                  roleLabel: participant.roleLabel,
                  status: participant.status,
                  remarks: participant.remarks,
                  sortOrder: participant.sortOrder,
                })),
              }
            : undefined,
          agendaItems: agendaItems.length
            ? {
                create: agendaItems.map((item) => ({
                  title: item.title,
                  description: item.description,
                  sortOrder: item.sortOrder,
                })),
              }
            : undefined,
        },
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
          agendaItems: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeeting",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: existingMeeting,
      afterJson: updated,
    });

    return NextResponse.json(updated);
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
