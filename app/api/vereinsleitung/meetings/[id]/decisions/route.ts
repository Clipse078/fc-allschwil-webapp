import { NextResponse } from "next/server";
import { type VereinsleitungMeetingDecisionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type DecisionInput = {
  agendaItemId: string | null;
  agendaItemTitle: string | null;
  decisionText: string;
  decisionType: VereinsleitungMeetingDecisionType;
  responsiblePersonId: string | null;
  responsibleDisplayName: string | null;
  dueDate: Date | null;
  createMatter: boolean;
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

function normalizeOptionalDateTime(value: unknown, fieldLabel: string) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return { value: null } as const;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return { error: fieldLabel + " ist ungültig." } as const;
  }

  return { value: parsed } as const;
}

function parseDecisionType(
  value: unknown,
): { value: VereinsleitungMeetingDecisionType } | { error: string } {
  const decisionType = String(value ?? "DECISION").trim().toUpperCase();

  switch (decisionType) {
    case "DECISION":
      return { value: "DECISION" };
    case "TASK":
      return { value: "TASK" };
    case "APPROVAL":
      return { value: "APPROVAL" };
    case "INFO":
      return { value: "INFO" };
    default:
      return { error: "Ungültiger Entscheidungstyp: " + decisionType };
  }
}

function normalizeDecision(
  value: unknown,
  index: number,
): { value: DecisionInput } | { error: string } {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const decisionText = String(record.decisionText ?? "").trim();

  if (!decisionText) {
    return { error: "Jede Entscheidung braucht einen Beschlusstext." };
  }

  const decisionTypeResult = parseDecisionType(record.decisionType);

  if ("error" in decisionTypeResult) {
    return { error: decisionTypeResult.error };
  }

  const dueDateResult = normalizeOptionalDateTime(record.dueDate, "Fälligkeitsdatum");

  if ("error" in dueDateResult) {
    return { error: dueDateResult.error ?? "Fälligkeitsdatum ist ungültig." };
  }

  return {
    value: {
      agendaItemId: normalizeOptionalString(record.agendaItemId),
      agendaItemTitle: normalizeOptionalString(record.agendaItemTitle),
      decisionText,
      decisionType: decisionTypeResult.value,
      responsiblePersonId: normalizeOptionalString(record.responsiblePersonId),
      responsibleDisplayName: normalizeOptionalString(record.responsibleDisplayName),
      dueDate: dueDateResult.value,
      createMatter: Boolean(record.createMatter),
      remarks: normalizeOptionalString(record.remarks),
      sortOrder: index,
    },
  };
}

function normalizeDecisionPayload(body: unknown) {
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)) {
    const items = (body as { items: unknown[] }).items;
    const decisions: DecisionInput[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const normalized = normalizeDecision(items[index], index);

      if ("error" in normalized) {
        return { error: normalized.error } as const;
      }

      decisions.push(normalized.value);
    }

    return { value: decisions } as const;
  }

  const normalized = normalizeDecision(body, 0);

  if ("error" in normalized) {
    return { error: normalized.error } as const;
  }

  return { value: [normalized.value] } as const;
}

async function validateResponsiblePeople(decisions: DecisionInput[]) {
  const personIds = Array.from(
    new Set(
      decisions
        .map((decision) => decision.responsiblePersonId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (personIds.length === 0) {
    return { ok: true } as const;
  }

  const people = await prisma.person.findMany({
    where: {
      id: {
        in: personIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (people.length !== personIds.length) {
    return {
      ok: false,
      error: "Mindestens eine verantwortliche Person wurde nicht gefunden.",
    } as const;
  }

  return { ok: true } as const;
}

function buildMatterTitle(decision: DecisionInput) {
  if (decision.agendaItemTitle) {
    return decision.agendaItemTitle + " — " + decision.decisionText;
  }

  return decision.decisionText;
}

function buildMatterDescription(decision: DecisionInput, meetingTitle: string) {
  const lines = [
    "Auto-generiert aus Meeting-Entscheid.",
    "Meeting: " + meetingTitle,
    decision.agendaItemTitle ? "Traktandum: " + decision.agendaItemTitle : null,
    decision.remarks ? "Bemerkung: " + decision.remarks : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function mapDecisionTypeToMatterPriority(decisionType: VereinsleitungMeetingDecisionType) {
  switch (decisionType) {
    case "TASK":
      return "HIGH";
    case "APPROVAL":
      return "HIGH";
    case "DECISION":
      return "MEDIUM";
    case "INFO":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_VIEW,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  const meeting = await prisma.vereinsleitungMeeting.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
  }

  const decisions = await prisma.vereinsleitungMeetingDecision.findMany({
    where: { meetingId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      responsiblePerson: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });

  return NextResponse.json(decisions);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  try {
    const meeting = await prisma.vereinsleitungMeeting.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting wurde nicht gefunden." }, { status: 404 });
    }

    const body = await request.json();
    const decisionsResult = normalizeDecisionPayload(body);

    if ("error" in decisionsResult) {
      return NextResponse.json({ error: decisionsResult.error }, { status: 400 });
    }

    const decisions = Array.from(decisionsResult.value);

    const validation = await validateResponsiblePeople(decisions);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const currentDecisionCount = await prisma.vereinsleitungMeetingDecision.count({
      where: { meetingId: id },
    });

    const currentMatterLinkCount = await prisma.vereinsleitungMeetingMatter.count({
      where: { meetingId: id },
    });

    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (let index = 0; index < decisions.length; index += 1) {
        const decision = decisions[index];

        const createdDecision = await tx.vereinsleitungMeetingDecision.create({
          data: {
            meetingId: id,
            agendaItemId: decision.agendaItemId,
            agendaItemTitle: decision.agendaItemTitle,
            decisionText: decision.decisionText,
            decisionType: decision.decisionType,
            responsiblePersonId: decision.responsiblePersonId,
            responsibleDisplayName: decision.responsibleDisplayName,
            dueDate: decision.dueDate,
            createMatter: decision.createMatter,
            remarks: decision.remarks,
            sortOrder: currentDecisionCount + index,
          },
          include: {
            responsiblePerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        });

        let createdMatter = null;

        if (decision.createMatter) {
          createdMatter = await tx.vereinsleitungMatter.create({
            data: {
              title: buildMatterTitle(decision),
              description: buildMatterDescription(decision, meeting.title),
              status: "OPEN",
              priority: mapDecisionTypeToMatterPriority(decision.decisionType),
              ownerPersonId: decision.responsiblePersonId,
              dueDate: decision.dueDate,
            },
          });

          await tx.vereinsleitungMeetingMatter.create({
            data: {
              meetingId: id,
              matterId: createdMatter.id,
              sortOrder: currentMatterLinkCount + index,
            },
          });
        }

        results.push({
          decision: createdDecision,
          createdMatter,
        });
      }

      return results;
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingDecision",
      entityId: id,
      action: "CREATE",
      afterJson: {
        meetingId: id,
        createdCount: created.length,
        created,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create meeting decision failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Entscheidung konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const decisionId = String(body.decisionId ?? "").trim();

    if (!decisionId) {
      return NextResponse.json({ error: "decisionId ist erforderlich." }, { status: 400 });
    }

    const normalized = normalizeDecision(body, 0);

    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const decision = normalized.value;
    const validation = await validateResponsiblePeople([decision]);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const existing = await prisma.vereinsleitungMeetingDecision.findFirst({
      where: {
        id: decisionId,
        meetingId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entscheidung wurde nicht gefunden." }, { status: 404 });
    }

    const updated = await prisma.vereinsleitungMeetingDecision.update({
      where: { id: decisionId },
      data: {
        agendaItemId: decision.agendaItemId,
        agendaItemTitle: decision.agendaItemTitle,
        decisionText: decision.decisionText,
        decisionType: decision.decisionType,
        responsiblePersonId: decision.responsiblePersonId,
        responsibleDisplayName: decision.responsibleDisplayName,
        dueDate: decision.dueDate,
        createMatter: decision.createMatter,
        remarks: decision.remarks,
      },
      include: {
        responsiblePerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingDecision",
      entityId: decisionId,
      action: "UPDATE",
      beforeJson: existing,
      afterJson: updated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update meeting decision failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Entscheidung konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  try {
    const url = new URL(request.url);
    const decisionId = url.searchParams.get("decisionId")?.trim() ?? "";

    if (!decisionId) {
      return NextResponse.json({ error: "decisionId ist erforderlich." }, { status: 400 });
    }

    const existing = await prisma.vereinsleitungMeetingDecision.findFirst({
      where: {
        id: decisionId,
        meetingId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entscheidung wurde nicht gefunden." }, { status: 404 });
    }

    await prisma.vereinsleitungMeetingDecision.delete({
      where: { id: decisionId },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingDecision",
      entityId: decisionId,
      action: "DELETE",
      beforeJson: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete meeting decision failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Entscheidung konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
