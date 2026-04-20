import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { NextResponse } from "next/server";

const ALLOWED_STATUSES = new Set(["OPEN", "IN_PROGRESS", "DONE"]);
const ALLOWED_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

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

async function validateOwnerPersonId(ownerPersonId: string | null) {
  if (!ownerPersonId) {
    return null;
  }

  const owner = await prisma.person.findUnique({
    where: { id: ownerPersonId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!owner || !owner.isActive) {
    return { error: "Zugewiesene Person wurde nicht gefunden oder ist inaktiv." };
  }

  return { owner };
}

function normalizeDueDate(value: unknown) {
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

export async function GET() {
  const access = await requireApiAnyPermission(
    ROUTE_PERMISSION_SETS.VEREINSLEITUNG_COCKPIT_READ,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const matters = await prisma.vereinsleitungMatter.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  return NextResponse.json(matters);
}

export async function POST(request: Request) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_PENDENZEN_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const descriptionValue = String(body.description ?? "").trim();
    const priority = String(body.priority ?? "MEDIUM").trim().toUpperCase();
    const ownerPersonId = String(body.ownerPersonId ?? "").trim() || null;
    const dueDate = normalizeDueDate(body.dueDate);

    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    if (!ALLOWED_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: "Ungueltige Prioritaet." }, { status: 400 });
    }

    if (dueDate === "INVALID_DATE") {
      return NextResponse.json({ error: "Ungueltiges Faelligkeitsdatum." }, { status: 400 });
    }

    const ownerValidation = await validateOwnerPersonId(ownerPersonId);

    if (ownerValidation && "error" in ownerValidation) {
      return NextResponse.json({ error: ownerValidation.error }, { status: 400 });
    }

    const matter = await prisma.vereinsleitungMatter.create({
      data: {
        title,
        description: descriptionValue ? descriptionValue : null,
        status: "OPEN",
        priority,
        ownerPersonId,
        dueDate,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMatter",
      entityId: matter.id,
      action: "CREATE",
      afterJson: matter,
    });

    return NextResponse.json(matter, { status: 201 });
  } catch (error) {
    console.error("Create matter failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Thema konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_PENDENZEN_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich." }, { status: 400 });
    }

    const existingMatter = await prisma.vereinsleitungMatter.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!existingMatter) {
      return NextResponse.json({ error: "Thema wurde nicht gefunden." }, { status: 404 });
    }

    const data: {
      status?: string;
      title?: string;
      description?: string | null;
      priority?: string;
      ownerPersonId?: string | null;
      dueDate?: Date | null;
    } = {};

    if (body.status !== undefined) {
      const status = String(body.status ?? "").trim().toUpperCase();

      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ error: "Ungueltiger Status." }, { status: 400 });
      }

      data.status = status;
    }

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();

      if (!title) {
        return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
      }

      data.title = title;
    }

    if (body.description !== undefined) {
      const descriptionValue = String(body.description ?? "").trim();
      data.description = descriptionValue ? descriptionValue : null;
    }

    if (body.priority !== undefined) {
      const priority = String(body.priority ?? "").trim().toUpperCase();

      if (!ALLOWED_PRIORITIES.has(priority)) {
        return NextResponse.json({ error: "Ungueltige Prioritaet." }, { status: 400 });
      }

      data.priority = priority;
    }

    if (body.ownerPersonId !== undefined) {
      const ownerPersonId = String(body.ownerPersonId ?? "").trim() || null;
      const ownerValidation = await validateOwnerPersonId(ownerPersonId);

      if (ownerValidation && "error" in ownerValidation) {
        return NextResponse.json({ error: ownerValidation.error }, { status: 400 });
      }

      data.ownerPersonId = ownerPersonId;
    }

    if (body.dueDate !== undefined) {
      const dueDate = normalizeDueDate(body.dueDate);

      if (dueDate === "INVALID_DATE") {
        return NextResponse.json({ error: "Ungueltiges Faelligkeitsdatum." }, { status: 400 });
      }

      data.dueDate = dueDate;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Keine gueltigen Aenderungen uebergeben." },
        { status: 400 },
      );
    }

    const updatedMatter = await prisma.vereinsleitungMatter.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMatter",
      entityId: updatedMatter.id,
      action: "UPDATE",
      beforeJson: existingMatter,
      afterJson: updatedMatter,
    });

    return NextResponse.json(updatedMatter);
  } catch (error) {
    console.error("Update matter failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Thema konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_PENDENZEN_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get("id") ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich." }, { status: 400 });
    }

    const existingMatter = await prisma.vereinsleitungMatter.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!existingMatter) {
      return NextResponse.json({ error: "Thema wurde nicht gefunden." }, { status: 404 });
    }

    await prisma.vereinsleitungMatter.delete({
      where: { id },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungMatter",
      entityId: existingMatter.id,
      action: "DELETE",
      beforeJson: existingMatter,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete matter failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Thema konnte nicht geloescht werden." },
      { status: 500 },
    );
  }
}
