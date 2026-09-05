import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { InitiativeStatus, VisibilityScope } from "@prisma/client";
import { getInitiatives } from "@/lib/initiatives/queries";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireStrategicApiContext } from "@/lib/permissions/require-strategic-api-context";

export async function GET() {
  const access = await requireStrategicApiContext([
    PERMISSIONS.INITIATIVES_VIEW,
    PERMISSIONS.INITIATIVES_MANAGE,
  ]);
  if (!access.ok) return access.response;
  const initiatives = await getInitiatives(access.context.actor);
  return NextResponse.json({ initiatives });
}

export async function POST(request: NextRequest) {
  const access = await requireStrategicApiContext([
    PERMISSIONS.INITIATIVES_MANAGE,
  ]);
  if (!access.ok) return access.response;
  const { actor, tenantId } = access.context;

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

    const existing = await prisma.initiative.findFirst({
      where: { slug, tenantId },
      select: { id: true },
    });
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
        tenantId,
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
        // Phase D: target group refs for resolved-member visibility
        visibleTargetGroupRefs: Array.isArray(body?.visibleTargetGroupRefs) ? body.visibleTargetGroupRefs : undefined,
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
