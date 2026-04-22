import { NextResponse } from "next/server";
import {
  Prisma,
  VereinsleitungInitiativeStatus,
  VereinsleitungInitiativeWorkItemAssigneeMode,
  VereinsleitungInitiativeWorkItemStatus,
  type VereinsleitungMeetingDecisionType,
} from "@prisma/client";
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
  initiativeId: string | null;
  createInitiative: boolean;
  initiativeTitle: string | null;
  remarks: string | null;
  sortOrder: number;
};

type AccessLike =
  | {
      session?: {
        user?: {
          id?: string | null;
          effectiveUserId?: string | null;
          permissionKeys?: string[] | null;
        } | null;
      } | null;
    }
  | null
  | undefined;

type CreatedDecisionResult = {
  decision: Prisma.VereinsleitungMeetingDecisionGetPayload<{
    include: {
      responsiblePerson: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          displayName: true;
        };
      };
      initiative: {
        select: {
          id: true;
          slug: true;
          title: true;
          status: true;
        };
      };
    };
  }>;
  createdMatter: Prisma.VereinsleitungMatterGetPayload<Record<string, never>> | null;
  createdInitiative: Prisma.VereinsleitungInitiativeGetPayload<Record<string, never>> | null;
  createdWorkItem: Prisma.VereinsleitungInitiativeWorkItemGetPayload<Record<string, never>> | null;
};

type OptionalDateTimeResult =
  | { value: Date | null }
  | { error: string };

const DECISION_INCLUDE = {
  responsiblePerson: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
    },
  },
  initiative: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
    },
  },
} as const;

function getActorUserId(access: AccessLike) {
  return access?.session?.user?.effectiveUserId ?? access?.session?.user?.id ?? null;
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDateTime(
  value: unknown,
  fieldLabel: string,
): OptionalDateTimeResult {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return { value: null };
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return { error: fieldLabel + " ist ungültig." };
  }

  return { value: parsed };
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

  const dueDateResult = normalizeOptionalDateTime(
    record.dueDate,
    "Fälligkeitsdatum",
  );

  if ("error" in dueDateResult) {
    return { error: dueDateResult.error };
  }

  const createInitiative = Boolean(record.createInitiative);
  const initiativeId = normalizeOptionalString(record.initiativeId);
  const initiativeTitle = normalizeOptionalString(record.initiativeTitle);

  if (createInitiative && !initiativeTitle) {
    return { error: "Für eine neue Initiative ist ein Initiative-Titel erforderlich." };
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
      initiativeId,
      createInitiative,
      initiativeTitle,
      remarks: normalizeOptionalString(record.remarks),
      sortOrder: index,
    },
  };
}

function normalizeDecisionPayload(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { items?: unknown[] }).items)
  ) {
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

async function validateInitiatives(decisions: DecisionInput[]) {
  const initiativeIds = Array.from(
    new Set(
      decisions
        .map((decision) => decision.initiativeId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (initiativeIds.length === 0) {
    return { ok: true } as const;
  }

  const initiatives = await prisma.vereinsleitungInitiative.findMany({
    where: {
      id: {
        in: initiativeIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (initiatives.length !== initiativeIds.length) {
    return {
      ok: false,
      error: "Mindestens eine verknüpfte Initiative wurde nicht gefunden.",
    } as const;
  }

  return { ok: true } as const;
}

function buildMatterTitle(decision: DecisionInput) {
  if (decision.agendaItemTitle) {
    return decision.agendaItemTitle + " – " + decision.decisionText;
  }

  return decision.decisionText;
}

function buildMatterDescription(decision: DecisionInput, meetingTitle: string) {
  const lines = [
    "Auto-generiert aus Meeting-Entscheid.",
    "Meeting: " + meetingTitle,
    decision.agendaItemTitle ? "Traktandum: " + decision.agendaItemTitle : null,
    decision.remarks ? "Bemerkung: " + decision.remarks : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function buildInitiativeTitle(decision: DecisionInput) {
  if (decision.initiativeTitle) {
    return decision.initiativeTitle;
  }

  if (decision.agendaItemTitle) {
    return decision.agendaItemTitle;
  }

  return decision.decisionText;
}

function buildInitiativeDescription(decision: DecisionInput, meetingTitle: string) {
  const lines = [
    "Auto-generiert aus Meeting-Entscheid.",
    "Meeting: " + meetingTitle,
    decision.agendaItemTitle ? "Traktandum: " + decision.agendaItemTitle : null,
    "Entscheid: " + decision.decisionText,
    decision.remarks ? "Bemerkung: " + decision.remarks : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function buildWorkItemTitle(decision: DecisionInput) {
  if (decision.agendaItemTitle) {
    return decision.agendaItemTitle + " – " + decision.decisionText;
  }

  return decision.decisionText;
}

function buildWorkItemPriority(decisionType: VereinsleitungMeetingDecisionType) {
  switch (decisionType) {
    case "TASK":
      return "CRITICAL";
    case "APPROVAL":
      return "MAJOR";
    case "DECISION":
      return "MAJOR";
    case "INFO":
      return "MINOR";
    default:
      return "MAJOR";
  }
}

function buildAssigneeMode(decision: DecisionInput) {
  return decision.responsiblePersonId
    ? VereinsleitungInitiativeWorkItemAssigneeMode.PERSON
    : VereinsleitungInitiativeWorkItemAssigneeMode.NONE;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function buildUniqueInitiativeSlug(
  tx: Prisma.TransactionClient,
  title: string,
) {
  const baseSlug = slugify(title) || "initiative";
  const existing = await tx.vereinsleitungInitiative.findMany({
    where: {
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

function mapDecisionTypeToMatterPriority(
  decisionType: VereinsleitungMeetingDecisionType,
) {
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
    return NextResponse.json(
      { error: "Meeting wurde nicht gefunden." },
      { status: 404 },
    );
  }

  const decisions = await prisma.vereinsleitungMeetingDecision.findMany({
    where: { meetingId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: DECISION_INCLUDE,
  });

  return NextResponse.json(decisions);
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
      return NextResponse.json(
        { error: "Meeting wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const decisionsResult = normalizeDecisionPayload(body);

    if ("error" in decisionsResult) {
      return NextResponse.json({ error: decisionsResult.error }, { status: 400 });
    }

    const decisions = [...decisionsResult.value];
    const peopleValidation = await validateResponsiblePeople(decisions);

    if (!peopleValidation.ok) {
      return NextResponse.json({ error: peopleValidation.error }, { status: 400 });
    }

    const initiativeValidation = await validateInitiatives(decisions);

    if (!initiativeValidation.ok) {
      return NextResponse.json({ error: initiativeValidation.error }, { status: 400 });
    }

    const permissionKeys = access.session?.user?.permissionKeys ?? [];
    const needsInitiativePermission = decisions.some(
      (decision) => Boolean(decision.initiativeId) || decision.createInitiative,
    );

    if (
      needsInitiativePermission &&
      !permissionKeys.includes(PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE)
    ) {
      return NextResponse.json(
        {
          error:
            "Für Initiative-Verknüpfungen fehlt die Berechtigung vereinsleitung.initiatives.manage.",
        },
        { status: 403 },
      );
    }

    const currentDecisionCount = await prisma.vereinsleitungMeetingDecision.count({
      where: { meetingId },
    });

    const currentMatterLinkCount = await prisma.vereinsleitungMeetingMatter.count({
      where: { meetingId },
    });

    const created = await prisma.$transaction(async (tx) => {
      const results: CreatedDecisionResult[] = [];

      for (let index = 0; index < decisions.length; index += 1) {
        const decision = decisions[index];
        let linkedInitiativeId = decision.initiativeId;
        let linkedInitiativeTitle = decision.initiativeTitle;
        let createdInitiative: Prisma.VereinsleitungInitiativeGetPayload<Record<string, never>> | null =
          null;

        if (decision.createInitiative && !linkedInitiativeId) {
          const initiativeTitle = buildInitiativeTitle(decision);
          const initiativeSlug = await buildUniqueInitiativeSlug(tx, initiativeTitle);

          createdInitiative = await tx.vereinsleitungInitiative.create({
            data: {
              title: initiativeTitle,
              slug: initiativeSlug,
              description: buildInitiativeDescription(decision, meeting.title),
              status: VereinsleitungInitiativeStatus.IN_PROGRESS,
              ownerPersonId: decision.responsiblePersonId,
            },
          });

          linkedInitiativeId = createdInitiative.id;
          linkedInitiativeTitle = createdInitiative.title;
        } else if (linkedInitiativeId) {
          const linkedInitiative = await tx.vereinsleitungInitiative.findUnique({
            where: { id: linkedInitiativeId },
            select: { title: true },
          });

          linkedInitiativeTitle = linkedInitiative?.title ?? linkedInitiativeTitle;
        }

        const createdDecision = await tx.vereinsleitungMeetingDecision.create({
          data: {
            meetingId,
            agendaItemId: decision.agendaItemId,
            agendaItemTitle: decision.agendaItemTitle,
            decisionText: decision.decisionText,
            decisionType: decision.decisionType,
            responsiblePersonId: decision.responsiblePersonId,
            responsibleDisplayName: decision.responsibleDisplayName,
            dueDate: decision.dueDate,
            createMatter: decision.createMatter,
            initiativeId: linkedInitiativeId,
            createInitiative: Boolean(createdInitiative),
            initiativeTitle: linkedInitiativeTitle,
            remarks: decision.remarks,
            sortOrder: currentDecisionCount + index,
          },
          include: DECISION_INCLUDE,
        });

        let createdMatter: Prisma.VereinsleitungMatterGetPayload<Record<string, never>> | null =
          null;

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
              meetingId,
              matterId: createdMatter.id,
              sortOrder: currentMatterLinkCount + index,
            },
          });
        }

        let createdWorkItem: Prisma.VereinsleitungInitiativeWorkItemGetPayload<Record<string, never>> | null =
          null;

        if (linkedInitiativeId) {
          const lastWorkItem = await tx.vereinsleitungInitiativeWorkItem.findFirst({
            where: { initiativeId: linkedInitiativeId },
            orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
            select: { sortOrder: true },
          });

          createdWorkItem = await tx.vereinsleitungInitiativeWorkItem.create({
            data: {
              initiativeId: linkedInitiativeId,
              title: buildWorkItemTitle(decision),
              priority: buildWorkItemPriority(decision.decisionType),
              dueDate: decision.dueDate,
              assigneeMode: buildAssigneeMode(decision),
              assigneePersonId: decision.responsiblePersonId,
              externalAssigneeLabel: null,
              status: VereinsleitungInitiativeWorkItemStatus.BACKLOG,
              sortOrder: (lastWorkItem?.sortOrder ?? -1) + 1,
            },
          });
        }

        results.push({
          decision: createdDecision,
          createdMatter,
          createdInitiative,
          createdWorkItem,
        });
      }

      return results;
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMeetingDecision",
      entityId: meetingId,
      action: "CREATE",
      afterJson: {
        meetingId,
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
    const decisionId = String(body.decisionId ?? "").trim();

    if (!decisionId) {
      return NextResponse.json(
        { error: "decisionId ist erforderlich." },
        { status: 400 },
      );
    }

    const normalized = normalizeDecision(body, 0);

    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const decision = normalized.value;
    const peopleValidation = await validateResponsiblePeople([decision]);

    if (!peopleValidation.ok) {
      return NextResponse.json({ error: peopleValidation.error }, { status: 400 });
    }

    const initiativeValidation = await validateInitiatives([decision]);

    if (!initiativeValidation.ok) {
      return NextResponse.json({ error: initiativeValidation.error }, { status: 400 });
    }

    const permissionKeys = access.session?.user?.permissionKeys ?? [];
    const needsInitiativePermission =
      Boolean(decision.initiativeId) || decision.createInitiative;

    if (
      needsInitiativePermission &&
      !permissionKeys.includes(PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE)
    ) {
      return NextResponse.json(
        {
          error:
            "Für Initiative-Verknüpfungen fehlt die Berechtigung vereinsleitung.initiatives.manage.",
        },
        { status: 403 },
      );
    }

    const existing = await prisma.vereinsleitungMeetingDecision.findFirst({
      where: {
        id: decisionId,
        meetingId,
      },
      include: DECISION_INCLUDE,
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Entscheidung wurde nicht gefunden." },
        { status: 404 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let linkedInitiativeId = decision.initiativeId;
      let linkedInitiativeTitle = decision.initiativeTitle;

      if (decision.createInitiative && !linkedInitiativeId) {
        const initiativeTitle = buildInitiativeTitle(decision);
        const initiativeSlug = await buildUniqueInitiativeSlug(tx, initiativeTitle);

        const createdInitiative = await tx.vereinsleitungInitiative.create({
          data: {
            title: initiativeTitle,
            slug: initiativeSlug,
            description: buildInitiativeDescription(decision, "Meeting-Entscheid"),
            status: VereinsleitungInitiativeStatus.IN_PROGRESS,
            ownerPersonId: decision.responsiblePersonId,
          },
        });

        linkedInitiativeId = createdInitiative.id;
        linkedInitiativeTitle = createdInitiative.title;
      } else if (linkedInitiativeId) {
        const linkedInitiative = await tx.vereinsleitungInitiative.findUnique({
          where: { id: linkedInitiativeId },
          select: { title: true },
        });

        linkedInitiativeTitle = linkedInitiative?.title ?? linkedInitiativeTitle;
      } else {
        linkedInitiativeTitle = null;
      }

      return tx.vereinsleitungMeetingDecision.update({
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
          initiativeId: linkedInitiativeId,
          createInitiative: decision.createInitiative && !decision.initiativeId,
          initiativeTitle: linkedInitiativeTitle,
          remarks: decision.remarks,
        },
        include: DECISION_INCLUDE,
      });
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
    const decisionId = url.searchParams.get("decisionId")?.trim() ?? "";

    if (!decisionId) {
      return NextResponse.json(
        { error: "decisionId ist erforderlich." },
        { status: 400 },
      );
    }

    const existing = await prisma.vereinsleitungMeetingDecision.findFirst({
      where: {
        id: decisionId,
        meetingId,
      },
      include: DECISION_INCLUDE,
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Entscheidung wurde nicht gefunden." },
        { status: 404 },
      );
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
