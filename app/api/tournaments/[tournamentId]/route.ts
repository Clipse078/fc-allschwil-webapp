/**
 * PATCH /api/tournaments/[tournamentId]
 *
 * TOURNAMENTCENTER-01 — edit core/operational fields of a tenant-managed
 * Tournament (canonical Event, type=TOURNAMENT), and cancel/restore its
 * lifecycle.
 *
 * Body (all optional, partial update):
 *   title, description, location, startAt, endAt, meetingTime,
 *   organizerName, competitionLabel, resultLabel, remarks, teamId, homeAway,
 *   websiteVisible, infoboardVisible, homepageVisible, wochenplanVisible,
 *   teamPageVisible
 *   status  "CANCELLED" | "SCHEDULED"  — only these two transitions
 *
 * TOURNAMENTCENTER-01B: participant management (add/remove Team/
 * ExternalTeam/manual participants), tournament-level Spielfeld/Halle
 * allocations, and per-participant Garderobe allocations are NOT handled
 * here — see app/api/tournaments/[tournamentId]/participants/route.ts,
 * .../resource-allocations/route.ts, and
 * .../participants/[participantId]/dressing-room-allocations/route.ts.
 * The legacy pitchCode/homeDressingRoomCode/awayDressingRoomCode fields are
 * no longer part of the Tournament update surface (superseded by the
 * canonical FacilityResource-based allocation model above).
 *
 * `status` is handled as a dedicated lifecycle transition (cancel/restore)
 * via lib/tournaments/tournament-service.ts, separately from the field
 * update, mirroring app/api/training-sessions/[sessionId]/route.ts.
 *
 * Permission: EVENTS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  updateTournament,
  cancelTournament,
  restoreTournament,
} from "@/lib/tournaments/tournament-service";
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentInvalidTransitionError,
} from "@/lib/tournaments/errors";
import type { UpdateTournamentInput } from "@/lib/tournaments/types";

type RouteContext = { params: Promise<{ tournamentId: string }> };

const ALLOWED_STATUS_TRANSITIONS = ["CANCELLED", "SCHEDULED"] as const;

const STRING_OR_NULL_KEYS = [
  "description",
  "location",
  "organizerName",
  "competitionLabel",
  "resultLabel",
  "remarks",
  "teamId",
] as const;

const DATE_OR_NULL_KEYS = ["endAt", "meetingTime"] as const;

const ALLOWED_HOME_AWAY = ["HOME", "AWAY"] as const;

const BOOLEAN_KEYS = [
  "websiteVisible",
  "infoboardVisible",
  "homepageVisible",
  "wochenplanVisible",
  "teamPageVisible",
] as const;

function parseDateOrNull(value: unknown): { ok: true; value: Date | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireApiAnyPermission([PERMISSIONS.EVENTS_MANAGE]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const { tournamentId } = await params;
  if (!tournamentId?.trim()) {
    return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    // ── Lifecycle transition ────────────────────────────────────────────────
    if ("status" in body) {
      const status = body.status;
      if (!ALLOWED_STATUS_TRANSITIONS.includes(status as (typeof ALLOWED_STATUS_TRANSITIONS)[number])) {
        return NextResponse.json(
          { error: `status must be one of: ${ALLOWED_STATUS_TRANSITIONS.join(", ")}` },
          { status: 400 },
        );
      }

      const tournament =
        status === "CANCELLED"
          ? await cancelTournament(tenantId, tournamentId)
          : await restoreTournament(tenantId, tournamentId);

      revalidatePath("/dashboard/tournamentcenter");
      revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

      return NextResponse.json({ tournament });
    }

    // ── Field update ─────────────────────────────────────────────────────────
    const data: UpdateTournamentInput = {};

    if ("title" in body) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "title muss ein nicht-leerer String sein." }, { status: 400 });
      }
      data.title = body.title;
    }

    for (const key of STRING_OR_NULL_KEYS) {
      if (key in body) {
        const value = body[key];
        if (value === null || value === undefined) {
          (data as Record<string, unknown>)[key] = null;
        } else if (typeof value === "string") {
          (data as Record<string, unknown>)[key] = value;
        } else {
          return NextResponse.json({ error: `${key} muss ein String oder null sein.` }, { status: 400 });
        }
      }
    }

    if ("startAt" in body) {
      if (typeof body.startAt !== "string") {
        return NextResponse.json({ error: "startAt muss ein String sein." }, { status: 400 });
      }
      const parsed = new Date(body.startAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "startAt ist ungültig." }, { status: 400 });
      }
      data.startAt = parsed;
    }

    for (const key of DATE_OR_NULL_KEYS) {
      if (key in body) {
        const parsed = parseDateOrNull(body[key]);
        if (!parsed.ok) {
          return NextResponse.json({ error: `${key} ist ungültig.` }, { status: 400 });
        }
        (data as Record<string, unknown>)[key] = parsed.value;
      }
    }

    if ("homeAway" in body) {
      const value = body.homeAway;
      if (!ALLOWED_HOME_AWAY.includes(value as (typeof ALLOWED_HOME_AWAY)[number])) {
        return NextResponse.json(
          { error: `homeAway must be one of: ${ALLOWED_HOME_AWAY.join(", ")}` },
          { status: 400 },
        );
      }
      data.homeAway = value as (typeof ALLOWED_HOME_AWAY)[number];
    }

    for (const key of BOOLEAN_KEYS) {
      if (key in body) {
        const value = body[key];
        if (typeof value !== "boolean") {
          return NextResponse.json({ error: `${key} muss ein Boolean sein.` }, { status: 400 });
        }
        (data as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine gültigen Felder zum Aktualisieren." }, { status: 400 });
    }

    const tournament = await updateTournament(tenantId, tournamentId, data);

    revalidatePath("/dashboard/tournamentcenter");
    revalidatePath(`/dashboard/tournamentcenter/${tournamentId}/edit`);

    return NextResponse.json({ tournament });
  } catch (err) {
    if (err instanceof TournamentNotFoundError) {
      return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
    }
    if (err instanceof TournamentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TournamentInvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
