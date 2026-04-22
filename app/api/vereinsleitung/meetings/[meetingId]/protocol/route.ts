import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type ProtocolInput = {
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  notes: string;
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

function normalizeProtocolPayload(body: unknown) {
  const itemsSource =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)
      ? (body as { items: unknown[] }).items
      : [body];

  const items: ProtocolInput[] = [];

  for (let index = 0; index < itemsSource.length; index += 1) {
    const record =
      itemsSource[index] && typeof itemsSource[index] === "object"
        ? (itemsSource[index] as Record<string, unknown>)
        : {};

    const notes = String(record.notes ?? "").trim();

    if (!notes) {
      return { error: "Jeder Protokolleintrag braucht einen Text." } as const;
    }

    items.push({
      agendaItemId: normalizeOptionalString(record.agendaItemId),
      agendaItemTitle: normalizeOptionalString(record.agendaItemTitle),
      notes,
      sortOrder: index,
    });
  }

  return { value: items } as const;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_VIEW,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { meetingId } = await context.params;

  const meeting = await prisma.vereinsleitungMeeting.findUnique({
    where: { id: meetingId },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
  }

  const protocolEntries = await prisma.vereinsleitungMeetingProtocolEntry.findMany({
    where: { meetingId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(protocolEntries);
}

export async function POST(
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
    const meeting = await prisma.vereinsleitungMeeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const normalized = normalizeProtocolPayload(body);

    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const currentCount = await prisma.vereinsleitungMeetingProtocolEntry.count({
      where: { meetingId },
    });

    const created = await prisma.$transaction(
      normalized.value.map((entry, index) =>
        prisma.vereinsleitungMeetingProtocolEntry.create({
          data: { meetingId,
            agendaItemId: entry.agendaItemId,
            agendaItemTitle: entry.agendaItemTitle,
            notes: entry.notes,
            sortOrder: currentCount + index,
          },
        }),
      ),
    );

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingProtocolEntry",
      entityId: meetingId,
      action: "CREATE",
      afterJson: { meetingId,
        createdCount: created.length,
        created,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create meeting protocol entry failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Protokolleintrag konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
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
    const body = (await request.json()) as Record<string, unknown>;
    const entryId = String(body.entryId ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const agendaItemId = normalizeOptionalString(body.agendaItemId);
    const agendaItemTitle = normalizeOptionalString(body.agendaItemTitle);

    if (!entryId) {
      return NextResponse.json({ error: "entryId ist erforderlich." }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ error: "Bitte erfasse einen Protokolleintrag." }, { status: 400 });
    }

    const existing = await prisma.vereinsleitungMeetingProtocolEntry.findFirst({
      where: {
        id: entryId,
        meetingId: meetingId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Protokolleintrag wurde nicht gefunden." }, { status: 404 });
    }

    const updated = await prisma.vereinsleitungMeetingProtocolEntry.update({
      where: { id: entryId },
      data: {
        notes,
        agendaItemId,
        agendaItemTitle,
      },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingProtocolEntry",
      entityId: entryId,
      action: "UPDATE",
      beforeJson: existing,
      afterJson: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update meeting protocol entry failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Protokolleintrag konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const url = new URL(request.url);
    const entryId = url.searchParams.get("entryId")?.trim() ?? "";

    if (!entryId) {
      return NextResponse.json({ error: "entryId ist erforderlich." }, { status: 400 });
    }

    const existing = await prisma.vereinsleitungMeetingProtocolEntry.findFirst({
      where: {
        id: entryId,
        meetingId: meetingId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Protokolleintrag wurde nicht gefunden." }, { status: 404 });
    }

    await prisma.vereinsleitungMeetingProtocolEntry.delete({
      where: { id: entryId },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingProtocolEntry",
      entityId: entryId,
      action: "DELETE",
      beforeJson: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete meeting protocol entry failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Protokolleintrag konnte nicht gelÃƒÆ’Ã‚Â¶scht werden." },
      { status: 500 },
    );
  }
}



