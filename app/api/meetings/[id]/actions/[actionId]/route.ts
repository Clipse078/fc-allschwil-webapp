import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingActionStatus } from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string; actionId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, actionId } = await params;
  const actor = buildActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingAction.findUnique({ where: { id: actionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Massnahme nicht gefunden." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const validStatuses = Object.values(MeetingActionStatus);
  try {
    const updated = await prisma.meetingAction.update({
      where: { id: actionId },
      data: { title: body?.title?.trim() || undefined, owner: body?.owner?.trim() || null, dueDate: body?.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined, status: validStatuses.includes(body?.status) ? body.status : undefined },
      select: { id: true, title: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "ACTION_UPDATE", after: { actionId: updated.id, status: updated.status } });
    return NextResponse.json({ action: updated });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Massnahme konnte nicht aktualisiert werden." }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, actionId } = await params;
  const actor = buildActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingAction.findUnique({ where: { id: actionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Massnahme nicht gefunden." }, { status: 404 });
  await prisma.meetingAction.delete({ where: { id: actionId } });
  void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "ACTION_DELETE", before: { actionId } });
  return NextResponse.json({ message: "Massnahme gelöscht." });
}
