/**
 * GET/POST /api/tournaments/[tournamentId]/participants/[participantId]/dressing-room-allocations
 *
 * TOURNAMENTCENTER-01B — list/add per-participant Garderobe (dressing-room)
 * allocations. Independent per participant; multiple participants may
 * share the same dressing room when facility rules allow it.
 *
 * POST body: { facilityResourceId: string, notes?: string, displayOrder?: number }
 *
 * Permission: EVENTS_VIEW (read) / EVENTS_MANAGE (write)
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listParticipantDressingRoomAllocations,
  addParticipantDressingRoomAllocation,
} from "@/lib/tournaments/participant-allocation-service";
import { getTournamentParticipant } from "@/lib/tournaments/participant-service";
import {
  TournamentParticipantNotFoundError,
  TournamentParticipantAllocationResourceNotFoundError,
  TournamentParticipantAllocationArchivedResourceError,
  TournamentParticipantAllocationArchivedFacilityError,
  TournamentParticipantAllocationDuplicateError,
} from "@/lib/tournaments/errors";

type RouteContext = { params: Promise<{ tournamentId: string; participantId: string }> };

async function assertParticipantBelongsToTournament(
  tenantId: string,
  tournamentId: string,
  participantId: string,
) {
  const participant = await getTournamentParticipant(tenantId, participantId);
  if (participant.tournamentId !== tournamentId) {
    throw new TournamentParticipantNotFoundError(participantId);
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId, participantId } = await params;

  try {
    await assertParticipantBelongsToTournament(tenantId, tournamentId, participantId);
    const allocations = await listParticipantDressingRoomAllocations(tenantId, participantId);
    return NextResponse.json({ allocations });
  } catch (err) {
    if (err instanceof TournamentParticipantNotFoundError) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId, participantId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.facilityResourceId !== "string" || !body.facilityResourceId.trim()) {
    return NextResponse.json({ error: "facilityResourceId is required." }, { status: 400 });
  }

  try {
    await assertParticipantBelongsToTournament(tenantId, tournamentId, participantId);

    const allocation = await addParticipantDressingRoomAllocation(tenantId, participantId, {
      facilityResourceId: body.facilityResourceId.trim(),
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : undefined,
    });

    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err) {
    if (err instanceof TournamentParticipantNotFoundError) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }
    if (err instanceof TournamentParticipantAllocationResourceNotFoundError) {
      return NextResponse.json({ error: "Ressource nicht gefunden." }, { status: 404 });
    }
    if (
      err instanceof TournamentParticipantAllocationArchivedResourceError ||
      err instanceof TournamentParticipantAllocationArchivedFacilityError
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TournamentParticipantAllocationDuplicateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
