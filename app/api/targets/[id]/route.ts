import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { TargetCategory, TargetStatus, TargetPeriod, VisibilityScope } from "@prisma/client";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { requireTargetAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

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
  const actor = await getActorContext(check.session.user, check.session.user?.tenantId ?? undefined);

  const guard = await requireTargetAccess({ actor, id, access: "read" });
  if (!guard.ok) return guard.response;

  // Fetch full target detail after access is confirmed
  const target = await prisma.target.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      moduleKey: true,
      sportCategory: true,
      ageGroupHint: true,
      startsAt: true,
      endsAt: true,
      nudgeJson: true,
      createdAt: true,
      updatedAt: true,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          notes: true,
          sortOrder: true,
          dataPoints: {
            select: { id: true, value: true, note: true, measuredAt: true },
            orderBy: { measuredAt: "desc" },
            take: 10,
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ target });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = await getActorContext(check.session.user, check.session.user?.tenantId ?? undefined);

  const guard = await requireTargetAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));

    const validCategories = Object.values(TargetCategory);
    const validStatuses = Object.values(TargetStatus);
    const validPeriods = Object.values(TargetPeriod);
    const validScopes = Object.values(VisibilityScope);

    const updated = await prisma.target.update({
      where: { id },
      data: {
        title: body?.title?.trim() || undefined,
        description: body?.description?.trim() || null,
        category: validCategories.includes(body?.category as TargetCategory)
          ? (body.category as TargetCategory)
          : undefined,
        status: validStatuses.includes(body?.status as TargetStatus)
          ? (body.status as TargetStatus)
          : undefined,
        period: validPeriods.includes(body?.period as TargetPeriod)
          ? (body.period as TargetPeriod)
          : undefined,
        periodLabel: body?.periodLabel?.trim() || null,
        moduleKey: body?.moduleKey?.trim() || null,
        sportCategory: body?.sportCategory?.trim() || null,
        ageGroupHint: body?.ageGroupHint?.trim() || null,
        startsAt: body?.startsAt !== undefined ? (body.startsAt ? new Date(body.startsAt) : null) : undefined,
        endsAt: body?.endsAt !== undefined ? (body.endsAt ? new Date(body.endsAt) : null) : undefined,
        nudgeJson: body?.nudgeJson !== undefined ? body.nudgeJson : undefined,
        visibilityScope: validScopes.includes(body?.visibilityScope as VisibilityScope)
          ? (body.visibilityScope as VisibilityScope)
          : undefined,
        visibleOrgUnitRefs: Array.isArray(body?.visibleOrgUnitRefs) ? body.visibleOrgUnitRefs : undefined,
        visibleRoleRefs: Array.isArray(body?.visibleRoleRefs) ? body.visibleRoleRefs : undefined,
        visibleUserRefs: Array.isArray(body?.visibleUserRefs) ? body.visibleUserRefs : undefined,
      },
      select: { id: true, title: true },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "targets",
      entityId: id,
      action: "UPDATE",
      before: { id: guard.entity.id, title: guard.entity.title, reviewStage: guard.entity.reviewStage },
      after: { id: updated.id, title: updated.title },
    });

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error("Update target failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = await getActorContext(check.session.user, check.session.user?.tenantId ?? undefined);

  const guard = await requireTargetAccess({ actor, id, access: "delete" });
  if (!guard.ok) return guard.response;

  try {
    await prisma.target.delete({ where: { id } });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "targets",
      entityId: id,
      action: "DELETE",
      before: { id: guard.entity.id, title: guard.entity.title, reviewStage: guard.entity.reviewStage },
      after: null,
    });

    return NextResponse.json({ message: "Ziel wurde gelöscht." });
  } catch (error) {
    console.error("Delete target failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht gelöscht werden." }, { status: 500 });
  }
}
