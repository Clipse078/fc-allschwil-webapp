import { NextRequest, NextResponse } from "next/server";
import type { AttendanceEventKind, ParticipationResponseStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { respondToParticipation } from "@/lib/participation/participation-service";
import { toParticipationEventRef } from "@/lib/participation/event-reference";
import { assertTeamSeasonAccess } from "@/lib/participation/route-helpers";
import {
  ParticipationEventNotFoundError,
  ParticipationTenantMismatchError,
  ParticipationValidationError,
} from "@/lib/participation/errors";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

function mapParticipationError(error: unknown) {
  if (error instanceof ParticipationValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ParticipationTenantMismatchError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ParticipationEventNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  throw error;
}

export async function POST(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session?.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant aktiv." }, { status: 400 });
  }

  const { teamId, teamSeasonId } = await context.params;
  const teamSeason = await assertTeamSeasonAccess(teamId, teamSeasonId, tenantId);

  if (!teamSeason) {
    return NextResponse.json({ error: "Team-Saison nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const actorUserId = access.session?.user.id ?? null;
    const eventKind = String(body.eventKind ?? "") as AttendanceEventKind;
    const event = toParticipationEventRef({
      eventKind,
      trainingSessionId: body.trainingSessionId,
      eventId: body.eventId,
    });

    const response = await respondToParticipation(tenantId, actorUserId, {
      personId: String(body.personId ?? ""),
      teamSeasonId,
      event,
      status: body.status as ParticipationResponseStatus,
      note: body.note ?? null,
      responseSource: "TRAINER",
    });

    return NextResponse.json(response);
  } catch (error) {
    return mapParticipationError(error);
  }
}
