import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingAgendaItemStatus } from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id, itemId } = await params;
  const actor = buildActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: itemId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Traktandum nicht gefunden." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const validStatuses = Object.values(MeetingAgendaItemStatus);

  try {
    const updated = await prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: {
        title: body?.title?.trim() || undefined,
        notes: body?.notes?.trim() || null,
        owner: body?.owner?.trim() || null,
        durationMin: body?.durationMin !== undefined ? Number(body.durationMin) || null : undefined,
        orderIndex: body?.orderIndex !== undefined ? Number(body.orderIndex) : undefined,
        status: validStatuses.includes(body?.status) ? body.status : undefined,
      },
      select: { id: true, title: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "AGENDA_UPDATE", after: { itemId: updated.id } });
    return NextResponse.json({ item: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Traktandum konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id, itemId } = await params;
  const actor = buildActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: itemId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Traktandum nicht gefunden." }, { status: 404 });

  await prisma.meetingAgendaItem.delete({ where: { id: itemId } });
  void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "AGENDA_DELETE", before: { itemId } });
  return NextResponse.json({ message: "Traktandum gelöscht." });
}
