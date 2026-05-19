import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { MeetingActionStatus } from "@prisma/client";
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
  const actions = await prisma.meetingAction.findMany({
    where: { meetingId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, owner: true, dueDate: true, status: true },
  });
  return NextResponse.json({ actions });
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
  const validStatuses = Object.values(MeetingActionStatus);
  const status: MeetingActionStatus = validStatuses.includes(body?.status) ? body.status : MeetingActionStatus.OPEN;
  try {
    const action = await prisma.meetingAction.create({
      data: { meetingId: id, title, owner: body?.owner?.trim() || null, dueDate: body?.dueDate ? new Date(body.dueDate) : null, status, createdByUserId: actor.userId },
      select: { id: true, title: true, status: true },
    });
    void logAuditEvent({ actorUserId: actor.userId, module: "meetings", entityId: id, action: "ACTION_CREATE", after: { actionId: action.id, title: action.title } });
    return NextResponse.json({ action }, { status: 201 });
  } catch (e) { console.error(e); return NextResponse.json({ error: "Massnahme konnte nicht erstellt werden." }, { status: 500 }); }
}
