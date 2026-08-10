/**
 * PATCH/DELETE /api/tournaments/[tournamentId]/participants/[participantId]
 *
 * PATCH — TOURNAMENTCENTER-UX-03: updates the tournament-specific
 * Anzeigename ("displayName") of an EXTERNAL_CLUB participant. Body:
 *   { displayName: string | null }
 * Only valid for EXTERNAL_CLUB participants; never touches
 * ExternalClub.name/ExternalTeam.name.
 *
 * DELETE — TOURNAMENTCENTER-01B — removes a participant from a tournament.
 * Cascades to its dressing-room allocations (TournamentParticipantAllocation)
 * via the DB foreign key.
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
  updateTournamentParticipantDisplayName,
} from "@/lib/tournaments/participant-service";
import {
  TournamentParticipantNotFoundError,
  TournamentParticipantValidationError,
} from "@/lib/tournaments/errors";

type RouteContext = { params: Promise<{ tournamentId: string; participantId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  if (!("displayName" in body)) {
    return NextResponse.json({ error: "displayName is required." }, { status: 400 });
  }
  const displayName = typeof body.displayName === "string" ? body.displayName : null;

  try {
    // Enforce URL ownership: the participant must belong to the URL tournament.
    const existing = await getTournamentParticipant(tenantId, participantId);
    if (existing.tournamentId !== tournamentId) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }

    const participant = await updateTournamentParticipantDisplayName(tenantId, participantId, displayName);

    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ participant });
  } catch (err) {
    if (err instanceof TournamentParticipantNotFoundError) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden." }, { status: 404 });
    }
    if (err instanceof TournamentParticipantValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

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
