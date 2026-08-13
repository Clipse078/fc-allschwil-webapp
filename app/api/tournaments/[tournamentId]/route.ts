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
 *
 * DELETE /api/tournaments/[tournamentId] — ADMIN-DELETE-02A /
 * ADMIN-DELETE-02A-C1 permanent hard delete. Requires
 * PERMISSIONS.TOURNAMENTS_DELETE — deliberately NOT EVENTS_MANAGE, which
 * authorizes the PATCH above (including cancel/restore) but must never
 * imply permanent deletion on its own.
 *
 * Authorization model (mirrors app/api/teams/[teamId]/route.ts DELETE,
 * ADMIN-DELETE-01B):
 *   1. The target tournament (Event, type=TOURNAMENT) and therefore its
 *      owning tenant is resolved strictly server-side from
 *      `tournamentId` — a client-supplied tenantId is never read or
 *      trusted for this decision.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant.
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): a tournaments.delete holder is
 * NEVER blocked from permanently deleting a tournament merely because
 * participants, resource allocations, Weekplanner references, or
 * completed/archived history exist. Instead, this route implements a
 * two-step "inspect impact → explicit confirmation → atomic cleanup +
 * delete" flow on the SAME endpoint, driven by the `confirm` query
 * parameter:
 *
 *   DELETE .../[tournamentId]            → PREVIEW: returns 200 with the
 *                                           impact (dependency counts) and
 *                                           requiresConfirmation: true.
 *                                           Deletes nothing.
 *   DELETE .../[tournamentId]?confirm=true → PERFORM: atomically cleans up
 *                                             owned/reference data and
 *                                             permanently deletes the
 *                                             tournament. See
 *                                             lib/tournaments/tournament-lifecycle-service.ts.
 *
 * Both steps require the same authorization check — the impact preview
 * never leaks dependency information to an unauthorized caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { logAction } from "@/lib/audit/log-action";
import {
  updateTournament,
  cancelTournament,
  restoreTournament,
} from "@/lib/tournaments/tournament-service";
import {
  deleteTournamentPermanently,
  getTournamentDeletionImpact,
} from "@/lib/tournaments/tournament-lifecycle-service";
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
  // ORG-ACCESS-03: accept tenant-wide coordinators AND OrgUnit-scoped users.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 403 });
  }

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "User identity required." }, { status: 403 });
  }

  const { tournamentId } = await params;
  if (!tournamentId?.trim()) {
    return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
  }

  // ORG-ACCESS-03: load the tournament for scope check before processing body.
  const existingTournament = await prisma.event.findFirst({
    where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
    select: { id: true, source: true, teamId: true, reviewStage: true },
  });
  if (!existingTournament) {
    return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
  }

  const planningPolicy = createPlanningAuthorizationPolicy(prisma);
  const canEdit = await planningPolicy.canEditPlanningRecord(
    { userId, tenantId },
    "tournament",
    {
      teamId: existingTournament.teamId,
      planningStage: existingTournament.reviewStage,
      source: existingTournament.source,
    },
  );
  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung zum Bearbeiten dieses Turniers." },
      { status: 403 },
    );
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

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tournamentId } = await params;

  // Resolve the target tournament and its tenant strictly server-side —
  // never trust a client-supplied tenantId for a permanent-deletion
  // decision. Scoped to type: "TOURNAMENT" so this route can never delete a
  // MATCH/TRAINING/OTHER Event.
  const tournament = await prisma.event.findFirst({
    where: { id: tournamentId, type: "TOURNAMENT" },
    select: { id: true, tenantId: true },
  });

  if (!tournament || !tournament.tenantId) {
    return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
  }

  const tournamentTenantId = tournament.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.TOURNAMENTS_DELETE,
    tenantId: tournamentTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = request.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getTournamentDeletionImpact(tournamentTenantId, tournamentId);

    if (impact === null) {
      return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  try {
    const { deleted, impact } = await deleteTournamentPermanently(
      tournamentTenantId,
      tournamentId,
    );

    await logAction({
      actorUserId: session.user.effectiveUserId ?? session.user.id ?? null,
      moduleKey: "tournaments",
      entityType: "Tournament",
      entityId: tournamentId,
      action: "DELETE",
      beforeJson: { ...deleted, impact },
    });

    revalidatePath("/dashboard/tournamentcenter");

    return NextResponse.json({ message: "Turnier wurde endgültig gelöscht.", impact });
  } catch (error) {
    if (error instanceof TournamentNotFoundError) {
      return NextResponse.json({ error: "Turnier nicht gefunden." }, { status: 404 });
    }

    console.error("Delete tournament failed:", error);
    return NextResponse.json({ error: "Turnier konnte nicht gelöscht werden." }, { status: 500 });
  }
}
