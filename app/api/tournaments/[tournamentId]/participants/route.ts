/**
 * GET/POST /api/tournaments/[tournamentId]/participants
 *
 * TOURNAMENTCENTER-01B — list/add canonical multi-team participants
 * (Team | ExternalTeam | manual fallback) for a tenant-managed Tournament.
 *
 * POST body:
 *   { teamId: string }  |  { externalTeamId: string }  |  { manualLabel: string }
 *   Exactly one of these must be provided. Optional: displayOrder (number).
 *
 * Permission: EVENTS_VIEW (read) / EVENTS_MANAGE (write)
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listTournamentParticipants,
  addTournamentParticipant,
} from "@/lib/tournaments/participant-service";
import {
  TournamentNotFoundError,
  TournamentParticipantValidationError,
  TournamentParticipantTenantMismatchError,
  TournamentParticipantDuplicateError,
} from "@/lib/tournaments/errors";

type RouteContext = { params: Promise<{ tournamentId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_VIEW, PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId } = await params;

  try {
    const participants = await listTournamentParticipants(tenantId, tournamentId);
    return NextResponse.json({ participants });
  } catch (err) {
    if (err instanceof TournamentNotFoundError) {
      return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
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

  const { tournamentId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const teamId = typeof body.teamId === "string" ? body.teamId : undefined;
  const externalTeamId = typeof body.externalTeamId === "string" ? body.externalTeamId : undefined;
  const manualLabel = typeof body.manualLabel === "string" ? body.manualLabel : undefined;
  const displayOrder = typeof body.displayOrder === "number" ? body.displayOrder : undefined;

  try {
    const participant = await addTournamentParticipant(tenantId, tournamentId, {
      teamId,
      externalTeamId,
      manualLabel,
      displayOrder,
    });

    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ participant }, { status: 201 });
  } catch (err) {
    if (err instanceof TournamentNotFoundError) {
      return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
    }
    if (err instanceof TournamentParticipantValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TournamentParticipantTenantMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TournamentParticipantDuplicateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
