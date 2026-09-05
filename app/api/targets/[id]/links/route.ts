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
import { validateLinkPayload } from "@/lib/linking/helpers";
import { requireTargetAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireStrategicApiContext } from "@/lib/permissions/require-strategic-api-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireStrategicApiContext([PERMISSIONS.TARGETS_MANAGE]);
  if (!access.ok) return access.response;

  const { id } = await params;
  const { actor, tenantId } = access.context;

  const guard = await requireTargetAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  // Fetch current link state before mutation for audit trail
  const beforeLinks = await prisma.target.findFirst({
    where: { id, tenantId },
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
      where: { tenantId, slug: { in: requestedSlugs } },
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
      where: { tenantId, slug: { in: requestedSlugs } },
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
      where: { id, tenantId },
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
