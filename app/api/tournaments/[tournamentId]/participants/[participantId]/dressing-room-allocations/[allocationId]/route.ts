/**
 * DELETE /api/tournaments/[tournamentId]/participants/[participantId]/dressing-room-allocations/[allocationId]
 *
 * TOURNAMENTCENTER-01B — removes a per-participant Garderobe allocation.
 *
 * Permission: EVENTS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { removeParticipantDressingRoomAllocation } from "@/lib/tournaments/participant-allocation-service";
import { TournamentParticipantAllocationNotFoundError } from "@/lib/tournaments/errors";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ tournamentId: string; participantId: string; allocationId: string }>;
};

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId, participantId, allocationId } = await params;

  try {
    // Enforce URL ownership before mutation.
    const existing = await prisma.tournamentParticipantAllocation.findFirst({
      where: { id: allocationId, tenantId },
      select: { tournamentParticipantId: true },
    });
    if (!existing || existing.tournamentParticipantId !== participantId) {
      return NextResponse.json({ error: "Zuweisung nicht gefunden." }, { status: 404 });
    }

    await removeParticipantDressingRoomAllocation(tenantId, allocationId);

    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TournamentParticipantAllocationNotFoundError) {
      return NextResponse.json({ error: "Zuweisung nicht gefunden." }, { status: 404 });
    }
    throw err;
  }
}
