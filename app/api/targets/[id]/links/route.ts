/**
 * PATCH /api/targets/[id]/links
 *
 * Replaces the cross-module link sets on a Target.
 * Uses centralized requireTargetAccess() guard.
 *
 * Phase 2 TODOs:
 * - Emit audit log entry per link change.
 * - Support delta PATCH (add/remove individual refs) rather than full replace.
 * - Enforce permission check: only actors with TARGETS_MANAGE may modify links.
 * - Migrate from JSONB refs to FK junction tables (TargetInitiative, TargetMeeting).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { validateLinkPayload } from "@/lib/linking/helpers";
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const actor = await getActorContext(check.session.user);

  const guard = await requireTargetAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  // Fetch current link state before mutation for audit trail
  const beforeLinks = await prisma.target.findUnique({
    where: { id },
    select: { linkedInitiativeRefs: true, linkedMeetingRefs: true },
  });

  const body = await request.json().catch(() => ({}));

  // Shape validation
  const validation = validateLinkPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // DB-backed slug existence validation
  if (validation.initiativeRefs.length > 0) {
    const requestedSlugs = validation.initiativeRefs.map((r) => r.slug);
    const found = await prisma.initiative.findMany({
      where: { slug: { in: requestedSlugs } },
      select: { slug: true },
    });
    const foundSlugs = new Set(found.map((r) => r.slug));
    const unknown = requestedSlugs.find((s) => !foundSlugs.has(s));
    if (unknown) {
      return NextResponse.json(
        { error: `Initiative nicht gefunden: ${unknown}` },
        { status: 400 },
      );
    }
  }

  if (validation.meetingRefs.length > 0) {
    const requestedSlugs = validation.meetingRefs.map((r) => r.slug);
    const found = await prisma.meeting.findMany({
      where: { slug: { in: requestedSlugs } },
      select: { slug: true },
    });
    const foundSlugs = new Set(found.map((r) => r.slug));
    const unknown = requestedSlugs.find((s) => !foundSlugs.has(s));
    if (unknown) {
      return NextResponse.json(
        { error: `Meeting nicht gefunden: ${unknown}` },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.target.update({
      where: { id },
      data: {
        linkedInitiativeRefs: validation.initiativeRefs,
        linkedMeetingRefs: validation.meetingRefs,
      },
      select: {
        id: true,
        linkedInitiativeRefs: true,
        linkedMeetingRefs: true,
      },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "targets",
      entityId: id,
      action: "LINKS_UPDATE",
      before: beforeLinks ?? undefined,
      after: { linkedInitiativeRefs: updated.linkedInitiativeRefs, linkedMeetingRefs: updated.linkedMeetingRefs },
    });

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error("Update links failed:", error);
    return NextResponse.json(
      { error: "Verknüpfungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
