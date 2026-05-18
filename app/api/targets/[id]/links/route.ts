/**
 * PATCH /api/targets/[id]/links
 *
 * Replaces the cross-module link sets on a Target.
 * Accepts { initiativeRefs: EntityRef[], meetingRefs: EntityRef[] }.
 *
 * Phase 1: validates slugs against known stubs (MEETING_STUBS / INITIATIVE_STUBS).
 *
 * Phase 2 TODOs:
 * - Validate against real DB Meeting/Initiative records instead of stubs.
 * - Emit audit log entry per link change.
 * - Support delta PATCH (add/remove individual refs) rather than full replace.
 * - Enforce permission check: only actors with TARGETS_MANAGE may modify links.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { validateLinkPayload } from "@/lib/linking/helpers";

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

  const target = await prisma.target.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = validateLinkPayload(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
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

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error("Update links failed:", error);
    return NextResponse.json(
      { error: "Verknüpfungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
