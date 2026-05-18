import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { InitiativeStatus, VisibilityScope } from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { getInitiativeById } from "@/lib/initiatives/queries";
import { requireInitiativeAccess } from "@/lib/visibility/visibility-guards";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);
  const initiative = await getInitiativeById(id, actor);

  if (!initiative) {
    return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ initiative });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);

  const guard = await requireInitiativeAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const validStatuses = Object.values(InitiativeStatus);

    const rawProgress = body?.progress !== undefined ? Number(body.progress) : undefined;
    const progress =
      rawProgress !== undefined && Number.isInteger(rawProgress) && rawProgress >= 0 && rawProgress <= 100
        ? rawProgress
        : rawProgress === null
          ? null
          : undefined;

    const updated = await prisma.initiative.update({
      where: { id },
      data: {
        title: body?.title?.trim() || undefined,
        summary: body?.summary?.trim() || null,
        description: body?.description?.trim() || null,
        status: validStatuses.includes(body?.status as InitiativeStatus)
          ? (body.status as InitiativeStatus)
          : undefined,
        owner: body?.owner?.trim() || null,
        progress,
        dueDate:
          body?.dueDate !== undefined
            ? body.dueDate
              ? new Date(body.dueDate)
              : null
            : undefined,
        visibilityScope: Object.values(VisibilityScope).includes(body?.visibilityScope as VisibilityScope)
          ? (body.visibilityScope as VisibilityScope)
          : undefined,
        requiresFourEyeReview:
          typeof body?.requiresFourEyeReview === "boolean"
            ? body.requiresFourEyeReview
            : undefined,
      },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ initiative: updated });
  } catch (error) {
    console.error("Update initiative failed:", error);
    return NextResponse.json(
      { error: "Initiative konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);

  const guard = await requireInitiativeAccess({ actor, id, access: "delete" });
  if (!guard.ok) return guard.response;

  try {
    await prisma.initiative.delete({ where: { id } });
    return NextResponse.json({ message: "Initiative wurde gelöscht." });
  } catch (error) {
    console.error("Delete initiative failed:", error);
    return NextResponse.json(
      { error: "Initiative konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
