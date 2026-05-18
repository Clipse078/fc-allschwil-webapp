import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingStatus, VisibilityScope } from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { getMeetingById } from "@/lib/meetings/queries";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
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
  const actor = buildActorContext(check.session.user);
  const meeting = await getMeetingById(id, actor);

  if (!meeting) {
    return NextResponse.json({ error: "Meeting nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);

  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const validStatuses = Object.values(MeetingStatus);
    const validScopes = Object.values(VisibilityScope);

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: body?.title?.trim() || undefined,
        description: body?.description?.trim() || null,
        meetingDate: body?.meetingDate ? new Date(body.meetingDate) : undefined,
        location: body?.location?.trim() || null,
        attendeeCount: body?.attendeeCount !== undefined ? Number(body.attendeeCount) || null : undefined,
        status: validStatuses.includes(body?.status as MeetingStatus)
          ? (body.status as MeetingStatus)
          : undefined,
        visibilityScope: validScopes.includes(body?.visibilityScope as VisibilityScope)
          ? (body.visibilityScope as VisibilityScope)
          : undefined,
        requiresFourEyeReview:
          typeof body?.requiresFourEyeReview === "boolean"
            ? body.requiresFourEyeReview
            : undefined,
        visibleRoleRefs: Array.isArray(body?.visibleRoleRefs) ? body.visibleRoleRefs : undefined,
        visibleUserRefs: Array.isArray(body?.visibleUserRefs) ? body.visibleUserRefs : undefined,
      },
      select: { id: true, slug: true, title: true },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "meetings",
      entityId: id,
      action: "UPDATE",
      before: { id: guard.entity.id, slug: guard.entity.slug, reviewStage: guard.entity.reviewStage },
      after: { id: updated.id, slug: updated.slug, title: updated.title },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("Update meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = buildActorContext(check.session.user);

  const guard = await requireMeetingAccess({ actor, id, access: "delete" });
  if (!guard.ok) return guard.response;

  try {
    await prisma.meeting.delete({ where: { id } });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "meetings",
      entityId: id,
      action: "DELETE",
      before: { id: guard.entity.id, slug: guard.entity.slug, reviewStage: guard.entity.reviewStage },
      after: null,
    });

    return NextResponse.json({ message: "Meeting wurde gelöscht." });
  } catch (error) {
    console.error("Delete meeting failed:", error);
    return NextResponse.json({ error: "Meeting konnte nicht gelöscht werden." }, { status: 500 });
  }
}
