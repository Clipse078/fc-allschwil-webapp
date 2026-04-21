import { NextResponse } from "next/server";
import { type VereinsleitungInitiativeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseInitiativeStatus(value: unknown): VereinsleitungInitiativeStatus {
  const status = String(value ?? "IN_PROGRESS").trim().toUpperCase();

  switch (status) {
    case "PLANNED":
      return "PLANNED";
    case "DONE":
      return "DONE";
    default:
      return "IN_PROGRESS";
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ initiativeId: string }> },
) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { initiativeId } = await context.params;

  try {
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const ownerPersonId = normalizeOptionalString(body.ownerPersonId);
    const ownerRoleLabel = normalizeOptionalString(body.ownerRoleLabel);

    if (!title) {
      return NextResponse.json(
        { error: "Titel ist erforderlich." },
        { status: 400 },
      );
    }

    if (ownerPersonId) {
      const owner = await prisma.person.findUnique({
        where: { id: ownerPersonId },
        select: { id: true },
      });

      if (!owner) {
        return NextResponse.json(
          { error: "Verantwortliche Person wurde nicht gefunden." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.vereinsleitungInitiative.update({
      where: { id: initiativeId },
      data: {
        title,
        subtitle: normalizeOptionalString(body.subtitle),
        description: normalizeOptionalString(body.description),
        status: parseInitiativeStatus(body.status),
        startDate: normalizeOptionalDate(body.startDate),
        targetDate: normalizeOptionalDate(body.targetDate),
        ownerPersonId,
        ownerRoleLabel: ownerPersonId ? ownerRoleLabel : null,
      },
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
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update initiative failed:", error);

    return NextResponse.json(
      { error: "Initiative konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}