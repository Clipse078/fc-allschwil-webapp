import { NextResponse } from "next/server";
import {
  VereinsleitungInitiativeWorkItemAssigneeMode,
  VereinsleitungInitiativeWorkItemStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function normalizePriority(value: unknown) {
  const normalized = String(value ?? "MAJOR").trim().toUpperCase();
  if (["CRITICAL", "MAJOR", "MINOR"].includes(normalized)) {
    return normalized;
  }
  return "MAJOR";
}

function parseAssigneeMode(value: unknown): VereinsleitungInitiativeWorkItemAssigneeMode {
  const normalized = String(value ?? "NONE").trim().toUpperCase();

  switch (normalized) {
    case "PERSON":
      return "PERSON";
    case "EXTERNAL":
      return "EXTERNAL";
    default:
      return "NONE";
  }
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw + "T00:00:00.000Z");

  if (Number.isNaN(parsed.getTime())) {
    return "INVALID_DATE";
  }

  return parsed;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ initiativeId: string }> },
) {
  const access = await requireApiAnyPermission([PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { initiativeId } = await context.params;

  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const priority = normalizePriority(body.priority);
    const dueDate = normalizeOptionalDate(body.dueDate);
    const assigneeMode = parseAssigneeMode(body.assigneeMode);
    const assigneePersonId = normalizeOptionalString(body.assigneePersonId);
    const externalAssigneeLabel = normalizeOptionalString(body.externalAssigneeLabel);

    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    if (dueDate === "INVALID_DATE") {
      return NextResponse.json({ error: "Ungültiges Fälligkeitsdatum." }, { status: 400 });
    }

    if (assigneeMode === "PERSON" && !assigneePersonId) {
      return NextResponse.json({ error: "Bitte eine Person auswählen." }, { status: 400 });
    }

    if (assigneeMode === "EXTERNAL" && !externalAssigneeLabel) {
      return NextResponse.json({ error: "Bitte einen externen Assignee erfassen." }, { status: 400 });
    }

    const initiative = await prisma.vereinsleitungInitiative.findUnique({
      where: { id: initiativeId },
      select: { id: true },
    });

    if (!initiative) {
      return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
    }

    if (assigneePersonId) {
      const person = await prisma.person.findUnique({
        where: { id: assigneePersonId },
        select: { id: true },
      });

      if (!person) {
        return NextResponse.json({ error: "Person nicht gefunden." }, { status: 400 });
      }
    }

    const lastItem = await prisma.vereinsleitungInitiativeWorkItem.findFirst({
      where: { initiativeId },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      select: { sortOrder: true },
    });

    const created = await prisma.vereinsleitungInitiativeWorkItem.create({
      data: {
        initiativeId,
        title,
        priority,
        dueDate,
        assigneeMode,
        assigneePersonId: assigneeMode === "PERSON" ? assigneePersonId : null,
        externalAssigneeLabel: assigneeMode === "EXTERNAL" ? externalAssigneeLabel : null,
        status: VereinsleitungInitiativeWorkItemStatus.BACKLOG,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create initiative work item failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Work Item konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
