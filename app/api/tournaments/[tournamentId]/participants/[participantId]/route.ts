/**
 * DELETE /api/tournaments/[tournamentId]/participants/[participantId]
 *
 * TOURNAMENTCENTER-01B — removes a participant from a tournament. Cascades
 * to its dressing-room allocations (TournamentParticipantAllocation) via
 * the DB foreign key.
 *
 * Permission: EVENTS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getTournamentParticipant,
  removeTournamentParticipant,
} from "@/lib/tournaments/participant-service";
import { TournamentParticipantNotFoundError } from "@/lib/tournaments/errors";

type RouteContext = { params: Promise<{ tournamentId: string; participantId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId, participantId } = await params;

  try {
    // Enforce URL ownership: the participant must belong to the URL tournament.
    const existing = await getTournamentParticipant(tenantId, participantId);
    if (existing.tournamentId !== tournamentId) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }

    await removeTournamentParticipant(tenantId, participantId);

    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TournamentParticipantNotFoundError) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }
    throw err;
  }
}
