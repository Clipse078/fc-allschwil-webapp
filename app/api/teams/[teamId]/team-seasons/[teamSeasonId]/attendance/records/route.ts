import { NextRequest, NextResponse } from "next/server";
import type { AttendanceEventKind, AttendanceStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { bulkUpsertEventAttendance, upsertAttendanceRecord } from "@/lib/attendance/attendance-service";
import { toAttendanceEventRef } from "@/lib/attendance/event-reference";
import { assertTeamSeasonAccess } from "@/lib/attendance/route-helpers";
import {
  AttendanceEventNotFoundError,
  AttendanceTenantMismatchError,
  AttendanceValidationError,
} from "@/lib/attendance/errors";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

function mapAttendanceError(error: unknown) {
  if (error instanceof AttendanceValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AttendanceTenantMismatchError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof AttendanceEventNotFoundError) {
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

    if (Array.isArray(body.entries)) {
      const eventKind = String(body.eventKind ?? "") as AttendanceEventKind;
      const event = toAttendanceEventRef({
        eventKind,
        trainingSessionId: body.trainingSessionId,
        eventId: body.eventId,
      });

      const entries = body.entries.map(
        (entry: { personId: string; status: AttendanceStatus; note?: string | null }) => ({
          personId: String(entry.personId),
          status: entry.status,
          note: entry.note ?? null,
        }),
      );

      const result = await bulkUpsertEventAttendance(
        tenantId,
        actorUserId,
        teamSeasonId,
        event,
        entries,
      );

      return NextResponse.json(result);
    }

    const eventKind = String(body.eventKind ?? "") as AttendanceEventKind;
    const event = toAttendanceEventRef({
      eventKind,
      trainingSessionId: body.trainingSessionId,
      eventId: body.eventId,
    });

    const record = await upsertAttendanceRecord(tenantId, actorUserId, {
      personId: String(body.personId ?? ""),
      teamSeasonId,
      event,
      status: body.status as AttendanceStatus,
      note: body.note ?? null,
    });

    return NextResponse.json(record);
  } catch (error) {
    return mapAttendanceError(error);
  }
}
