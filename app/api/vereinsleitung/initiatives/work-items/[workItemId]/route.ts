import { NextResponse } from "next/server";
import { type VereinsleitungInitiativeWorkItemAssigneeMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizePriority(value: unknown) {
  const normalized = String(value ?? "MAJOR").trim().toUpperCase();
  if (["CRITICAL", "MAJOR", "MINOR"].includes(normalized)) {
    return normalized;
  }
  return "MAJOR";
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

function parseStatus(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();

  switch (normalized) {
    case "BACKLOG":
    case "IN_PROGRESS":
    case "RESOLVED":
      return normalized;
    default:
      return null;
  }
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workItemId: string }> },
) {
  const access = await requireApiAnyPermission([PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { workItemId } = await context.params;

  try {
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const priority = normalizePriority(body.priority);
    const dueDate = normalizeOptionalDate(body.dueDate);
    const status = parseStatus(body.status);
    const assigneeMode = parseAssigneeMode(body.assigneeMode);
    const assigneePersonId = normalizeOptionalString(body.assigneePersonId);
    const externalAssigneeLabel = normalizeOptionalString(body.externalAssigneeLabel);

    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
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

    const existing = await prisma.vereinsleitungInitiativeWorkItem.findUnique({
      where: { id: workItemId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work Item nicht gefunden." }, { status: 404 });
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

    const updated = await prisma.vereinsleitungInitiativeWorkItem.update({
      where: { id: workItemId },
      data: {
        title,
        priority,
        dueDate,
        assigneeMode,
        assigneePersonId: assigneeMode === "PERSON" ? assigneePersonId : null,
        externalAssigneeLabel: assigneeMode === "EXTERNAL" ? externalAssigneeLabel : null,
        status,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update initiative work item failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Work Item konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workItemId: string }> },
) {
  const access = await requireApiAnyPermission([PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { workItemId } = await context.params;

  try {
    const existing = await prisma.vereinsleitungInitiativeWorkItem.findUnique({
      where: { id: workItemId },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Work Item nicht gefunden." }, { status: 404 });
    }

    await prisma.vereinsleitungInitiativeWorkItem.delete({
      where: { id: workItemId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete initiative work item failed:", error);

    return NextResponse.json(
      { error: "Work Item konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
