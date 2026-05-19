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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "read" });
  if (!guard.ok) return guard.response;
  const decisions = await prisma.meetingDecision.findMany({
    where: { meetingId: id },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, description: true, status: true, owner: true, orderIndex: true },
  });
  return NextResponse.json({ decisions });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const { id } = await params;
  const actor = await getActorContext(check.session.user);
  const guard = await requireMeetingAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));
  const title = (body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  const validStatuses = Object.values(MeetingDecisionStatus);
  const status: MeetingDecisionStatus = validStatuses.includes(body?.status) ? body.status : MeetingDecisionStatus.CONFIRMED;
  try {
    const decision = await prisma.meetingDecision.create({
      data: { meetingId: id, title, description: body?.description?.trim() || null, status, owner: body?.owner?.trim() || null, orderIndex: body?.orderIndex ?? 0, createdByUserId: actor.userId },
      select: { id: true, title: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "DECISION_CREATE", after: { decisionId: decision.id, title: decision.title } });
    return NextResponse.json({ decision }, { status: 201 });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Beschluss konnte nicht erstellt werden." }, { status: 500 }); }
}
