import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { InitiativeStatus, VisibilityScope } from "@prisma/client";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { getInitiatives } from "@/lib/initiatives/queries";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const actor = await getActorContext(check.session.user);
  const initiatives = await getInitiatives(actor);
  return NextResponse.json({ initiatives });
}

export async function POST(request: NextRequest) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const actor = await getActorContext(check.session.user);
  if (!actor.permissionKeys.includes("initiatives.manage")) {
    return NextResponse.json({ error: "initiatives.manage Berechtigung erforderlich." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const title = (body?.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    const rawSlug = (body?.slug ?? "").trim();
    const slug =
      rawSlug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const existing = await prisma.initiative.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${slug}" ist bereits vergeben.` },
        { status: 409 },
      );
    }

    const validStatuses = Object.values(InitiativeStatus);
    const status: InitiativeStatus = validStatuses.includes(body?.status as InitiativeStatus)
      ? (body.status as InitiativeStatus)
      : InitiativeStatus.PLANNED;

    const rawProgress = body?.progress !== undefined ? Number(body.progress) : null;
    const progress =
      rawProgress !== null && Number.isInteger(rawProgress) && rawProgress >= 0 && rawProgress <= 100
        ? rawProgress
        : null;

    const created = await prisma.initiative.create({
      data: {
        slug,
        title,
        summary: body?.summary?.trim() || null,
        description: body?.description?.trim() || null,
        status,
        owner: body?.owner?.trim() || null,
        progress,
        dueDate: body?.dueDate ? new Date(body.dueDate) : null,
        createdByUserId: actor.userId,
        visibleOrgUnitRefs: Array.isArray(body?.visibleOrgUnitRefs) ? body.visibleOrgUnitRefs : undefined,
        visibleRoleRefs: Array.isArray(body?.visibleRoleRefs) ? body.visibleRoleRefs : undefined,
        visibleUserRefs: Array.isArray(body?.visibleUserRefs) ? body.visibleUserRefs : undefined,
        visibilityScope: Object.values(VisibilityScope).includes(body?.visibilityScope as VisibilityScope)
          ? (body.visibilityScope as VisibilityScope)
          : VisibilityScope.ORGANISATION,
      },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ initiative: created }, { status: 201 });
  } catch (error) {
    console.error("Create initiative failed:", error);
    return NextResponse.json(
      { error: "Initiative konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
