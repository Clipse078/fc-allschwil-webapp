import { NextRequest, NextResponse } from "next/server";
import type { AttendanceEventKind } from "@prisma/client";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { toAttendanceEventRef } from "@/lib/attendance/event-reference";
import { getEventAttendanceSheet } from "@/lib/attendance/queries";
import { assertTeamSeasonAccess } from "@/lib/attendance/route-helpers";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

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

  const eventKind = request.nextUrl.searchParams.get("eventKind") as AttendanceEventKind | null;
  const trainingSessionId = request.nextUrl.searchParams.get("trainingSessionId");
  const eventId = request.nextUrl.searchParams.get("eventId");

  if (!eventKind) {
    return NextResponse.json({ error: "Event-Typ fehlt." }, { status: 400 });
  }

  const event = toAttendanceEventRef({
    eventKind,
    trainingSessionId,
    eventId,
  });

  const sheet = await getEventAttendanceSheet(tenantId, teamSeasonId, event);
  return NextResponse.json(sheet);
}
