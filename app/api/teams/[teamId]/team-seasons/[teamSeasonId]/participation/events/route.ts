import { NextRequest, NextResponse } from "next/server";
import type { AttendanceEventKind } from "@prisma/client";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getParticipationForEvent } from "@/lib/participation/queries";
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

export async function GET(request: NextRequest, context: Context) {
  const access = await requireApiAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    PERMISSIONS.TEAMS_DELETE,
  ]);

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

  const searchParams = request.nextUrl.searchParams;
  const eventKind = String(searchParams.get("eventKind") ?? "") as AttendanceEventKind;

  try {
    const event = toParticipationEventRef({
      eventKind,
      trainingSessionId: searchParams.get("trainingSessionId"),
      eventId: searchParams.get("eventId"),
    });

    const data = await getParticipationForEvent(tenantId, teamSeasonId, event);
    return NextResponse.json(data);
  } catch (error) {
    return mapParticipationError(error);
  }
}
