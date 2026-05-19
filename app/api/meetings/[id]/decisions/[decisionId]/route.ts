import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingDecisionStatus } from "@prisma/client";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { requireMeetingAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, error: "Unauthorized" };
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string; decisionId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, decisionId } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingDecision.findUnique({ where: { id: decisionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Beschluss nicht gefunden." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const validStatuses = Object.values(MeetingDecisionStatus);
  try {
    const updated = await prisma.meetingDecision.update({
      where: { id: decisionId },
      data: { title: body?.title?.trim() || undefined, description: body?.description?.trim() || null, status: validStatuses.includes(body?.status) ? body.status : undefined, owner: body?.owner?.trim() || null, orderIndex: body?.orderIndex !== undefined ? Number(body.orderIndex) : undefined },
      select: { id: true, title: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "DECISION_UPDATE", after: { decisionId: updated.id } });
    return NextResponse.json({ decision: updated });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Beschluss konnte nicht aktualisiert werden." }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id, decisionId } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const existing = await prisma.meetingDecision.findUnique({ where: { id: decisionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Beschluss nicht gefunden." }, { status: 404 });
  await prisma.meetingDecision.delete({ where: { id: decisionId } });
  void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "DECISION_DELETE", before: { decisionId } });
  return NextResponse.json({ message: "Beschluss gelöscht." });
}
