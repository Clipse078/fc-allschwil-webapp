import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingParticipantStatus } from "@prisma/client";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string; participantId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, participantId } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingParticipant.findUnique({ where: { id: participantId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const validStatuses = Object.values(MeetingParticipantStatus);
  try {
    const updated = await prisma.meetingParticipant.update({
      where: { id: participantId },
      data: { name: body?.name?.trim() || undefined, role: body?.role?.trim() || null, status: validStatuses.includes(body?.status) ? body.status : undefined, userId: body?.userId !== undefined ? (body.userId?.trim() || null) : undefined },
      select: { id: true, name: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "PARTICIPANT_UPDATE", after: { participantId: updated.id, status: updated.status } });
    return NextResponse.json({ participant: updated });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Teilnehmer konnte nicht aktualisiert werden." }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, participantId } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingParticipant.findUnique({ where: { id: participantId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
  await prisma.meetingParticipant.delete({ where: { id: participantId } });
  void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "PARTICIPANT_DELETE", before: { participantId } });
  return NextResponse.json({ message: "Teilnehmer entfernt." });
}
