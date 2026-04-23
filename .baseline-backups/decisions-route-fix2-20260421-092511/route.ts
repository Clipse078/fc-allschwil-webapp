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
    return { error: dueDateResult.error };
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

    const decisions = decisionsResult.value;

    const validation = await validateResponsiblePeople(decisions);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const currentCount = await prisma.vereinsleitungMeetingDecision.count({
      where: { meetingId: id },
    });

    const created = await prisma.$transaction(
      decisions.map((decision, index) =>
        prisma.vereinsleitungMeetingDecision.create({
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
            sortOrder: currentCount + index,
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
        }),
      ),
    );

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

