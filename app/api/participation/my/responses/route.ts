import { NextRequest, NextResponse } from "next/server";
import type { AttendanceEventKind, ParticipationResponseStatus } from "@prisma/client";
import { requireApiSession } from "@/lib/auth/require-api-session";
import {
  assertActorCanRespondForPerson,
} from "@/lib/participation/authorization";
import { respondToParticipation } from "@/lib/participation/participation-service";
import { toParticipationEventRef } from "@/lib/participation/event-reference";
import {
  ParticipationEventNotFoundError,
  ParticipationTenantMismatchError,
  ParticipationUnauthorizedError,
  ParticipationValidationError,
} from "@/lib/participation/errors";

function mapParticipationError(error: unknown) {
  if (error instanceof ParticipationValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ParticipationUnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ParticipationTenantMismatchError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ParticipationEventNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  throw error;
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();

  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const tenantId = session.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant aktiv." }, { status: 400 });
  }

  const actorUserId = session.session.user.id;

  try {
    const body = await request.json();
    const personId = String(body.personId ?? "");
    const teamSeasonId = String(body.teamSeasonId ?? "");

    const actor = await assertActorCanRespondForPerson(tenantId, actorUserId, personId);

    const eventKind = String(body.eventKind ?? "") as AttendanceEventKind;
    const event = toParticipationEventRef({
      eventKind,
      trainingSessionId: body.trainingSessionId,
      eventId: body.eventId,
    });

    const response = await respondToParticipation(tenantId, actorUserId, {
      personId,
      teamSeasonId,
      event,
      status: body.status as ParticipationResponseStatus,
      note: body.note ?? null,
      responseSource: actor.source,
    });

    return NextResponse.json(response);
  } catch (error) {
    return mapParticipationError(error);
  }
}
