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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const actor = await getActorContext(check.session.user, check.session.user?.tenantId ?? undefined);
  const guard = await requireMeetingAccess({ actor, id, access: "read" });
  if (!guard.ok) return guard.response;
  const participants = await prisma.meetingParticipant.findMany({
    where: { meetingId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, role: true, status: true, userId: true },
  });
  return NextResponse.json({ participants });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const actor = await getActorContext(check.session.user, check.session.user?.tenantId ?? undefined);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  const validStatuses = Object.values(MeetingParticipantStatus);
  const status: MeetingParticipantStatus = validStatuses.includes(body?.status) ? body.status : MeetingParticipantStatus.INVITED;
  try {
    const participant = await prisma.meetingParticipant.create({
      data: { meetingId: id, name, role: body?.role?.trim() || null, status, userId: body?.userId?.trim() || null },
      select: { id: true, name: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "PARTICIPANT_CREATE", after: { participantId: participant.id, name: participant.name } });
    return NextResponse.json({ participant }, { status: 201 });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Teilnehmer konnte nicht hinzugefügt werden." }, { status: 500 }); }
}
