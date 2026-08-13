/**
 * PATCH /api/matchcenter/[matchId]
 *
 * Updates locally managed operational fields of a match event.
 *
 * SFV-owned fields (homeAway, competitionLabel, title, location derived
 * from provider, externalMatchId, etc.) are NEVER updated here.
 *
 * Locally managed fields updated:
 *   - teamId          (internal FC Allschwil team assignment)
 *   - pitchCode       (Spielfeld)
 *   - homeDressingRoomCode
 *   - awayDressingRoomCode
 *   - websiteVisible
 *   - infoboardVisible
 *
 * Permission: EVENTS_MANAGE
 * Tenant isolation: tenantId resolved from session, never from request body.
 *
 * DELETE /api/matchcenter/[matchId] — ADMIN-DELETE-02A / ADMIN-DELETE-02A-C1
 * permanent hard delete. Requires PERMISSIONS.MATCHES_DELETE — deliberately
 * NOT EVENTS_MANAGE, which authorizes the PATCH above but must never imply
 * permanent deletion on its own.
 *
 * Authorization model (mirrors app/api/teams/[teamId]/route.ts DELETE,
 * ADMIN-DELETE-01B):
 *   1. The target match (Event, type=MATCH) and therefore its owning
 *      tenant is resolved strictly server-side from `matchId` — a
 *      client-supplied tenantId is never read or trusted for this decision.
 *   2. EffectivePermissionResolver.hasTenantDeletionAuthority() decides
 *      whether the caller may delete within that exact tenant.
 *
 * CORE PRODUCT RULE (ADMIN-DELETE-02A-C1): a matches.delete holder is NEVER
 * blocked from permanently deleting a match merely because an SFV/provider
 * mapping, a live/completed sporting state, or Weekplanner references
 * exist. Instead, this route implements a two-step "inspect impact →
 * explicit confirmation → atomic cleanup + delete" flow on the SAME
 * endpoint, driven by the `confirm` query parameter:
 *
 *   DELETE .../[matchId]            → PREVIEW: returns 200 with the impact
 *                                      (dependency counts) and
 *                                      requiresConfirmation: true. Deletes
 *                                      nothing.
 *   DELETE .../[matchId]?confirm=true → PERFORM: atomically cleans up owned/
 *                                        reference data, writes an
 *                                        SfvMatchDeletionTombstone when a
 *                                        provider mapping exists (so the
 *                                        next SFV sync never recreates it —
 *                                        SFV sync itself is unmodified), and
 *                                        permanently deletes the match. See
 *                                        lib/matchcenter/match-lifecycle-service.ts.
 *
 * Both steps require the same authorization check — the impact preview
 * never leaks dependency information to an unauthorized caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import { logAction } from "@/lib/audit/log-action";
import {
  MatchNotFoundError,
  deleteMatchPermanently,
  getMatchDeletionImpact,
} from "@/lib/matchcenter/match-lifecycle-service";

type RouteContext = { params: Promise<{ matchId: string }> };

type PatchBody = {
  teamId?: string | null;
  pitchCode?: string | null;
  homeDressingRoomCode?: string | null;
  awayDressingRoomCode?: string | null;
  websiteVisible?: boolean;
  infoboardVisible?: boolean;
};

const ALLOWED_STRING_KEYS = [
  "teamId",
  "pitchCode",
  "homeDressingRoomCode",
  "awayDressingRoomCode",
] as const;

const ALLOWED_BOOLEAN_KEYS = [
  "websiteVisible",
  "infoboardVisible",
] as const;

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  // ORG-ACCESS-03: accept tenant-wide coordinators AND OrgUnit-scoped users.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required." },
      { status: 403 },
    );
  }

  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "User identity required." }, { status: 403 });
  }

  const { matchId } = await params;
  if (!matchId?.trim()) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Load the event — include source, teamId, reviewStage for scope checks.
  const event = await prisma.event.findFirst({
    where: { id: matchId, tenantId, type: "MATCH" },
    select: { id: true, source: true, teamId: true, reviewStage: true },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Match nicht gefunden." },
      { status: 404 },
    );
  }

  // ORG-ACCESS-03: enforce OrgUnit scope and SFV protection.
  const planningPolicy = createPlanningAuthorizationPolicy(prisma);
  const canEdit = await planningPolicy.canEditPlanningRecord(
    { userId, tenantId },
    "match",
    {
      teamId: event.teamId,
      planningStage: event.reviewStage,
      source: event.source,
    },
  );
  if (!canEdit) {
    return NextResponse.json(
      { error: "Keine Berechtigung zum Bearbeiten dieses Spiels." },
      { status: 403 },
    );
  }

  // Build the data object from allowed locally-managed fields only
  const data: Record<string, string | boolean | null> = {};

  for (const key of ALLOWED_STRING_KEYS) {
    if (key in body) {
      const value = body[key];
      if (value === null || value === undefined) {
        data[key] = null;
      } else if (typeof value === "string") {
        data[key] = value.trim() || null;
      } else {
        return NextResponse.json(
          { error: `${key} muss ein String oder null sein.` },
          { status: 400 },
        );
      }
    }
  }

  for (const key of ALLOWED_BOOLEAN_KEYS) {
    if (key in body) {
      const value = body[key];
      if (typeof value !== "boolean") {
        return NextResponse.json(
          { error: `${key} muss ein Boolean sein.` },
          { status: 400 },
        );
      }
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Keine gültigen Felder zum Aktualisieren." },
      { status: 400 },
    );
  }

  // Validate teamId belongs to the same tenant if provided
  if ("teamId" in data && data.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId as string, tenantId },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Team nicht gefunden oder nicht zugreifbar." },
        { status: 404 },
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id: matchId },
    data,
    select: {
      id: true,
      teamId: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
      websiteVisible: true,
      infoboardVisible: true,
    },
  });

  // Invalidate the admin Matchcenter pages so the next visit reflects the saved state.
  revalidatePath("/dashboard/matchcenter");
  revalidatePath(`/dashboard/matchcenter/${matchId}`);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await params;

  // Resolve the target match and its tenant strictly server-side — never
  // trust a client-supplied tenantId for a permanent-deletion decision.
  // Scoped to type: "MATCH" so this route can never delete a
  // TRAINING/TOURNAMENT/OTHER Event.
  const match = await prisma.event.findFirst({
    where: { id: matchId, type: "MATCH" },
    select: { id: true, tenantId: true },
  });

  if (!match || !match.tenantId) {
    return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 });
  }

  const matchTenantId = match.tenantId;

  const resolver = createEffectivePermissionResolver(prisma);
  const authorized = await resolver.hasTenantDeletionAuthority({
    userId: session.user.id,
    permission: PERMISSIONS.MATCHES_DELETE,
    tenantId: matchTenantId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const confirmed = req.nextUrl.searchParams.get("confirm") === "true";

  if (!confirmed) {
    const impact = await getMatchDeletionImpact(matchTenantId, matchId);

    if (impact === null) {
      return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ impact, requiresConfirmation: true });
  }

  try {
    const deletedByUserId = session.user.effectiveUserId ?? session.user.id ?? null;
    const { deleted, impact } = await deleteMatchPermanently(
      matchTenantId,
      matchId,
      deletedByUserId,
    );

    await logAction({
      actorUserId: deletedByUserId,
      moduleKey: "matchcenter",
      entityType: "Match",
      entityId: matchId,
      action: "DELETE",
      beforeJson: { ...deleted, impact },
    });

    revalidatePath("/dashboard/matchcenter");

    return NextResponse.json({ message: "Match wurde endgültig gelöscht.", impact });
  } catch (error) {
    if (error instanceof MatchNotFoundError) {
      return NextResponse.json({ error: "Match nicht gefunden." }, { status: 404 });
    }

    console.error("Delete match failed:", error);
    return NextResponse.json({ error: "Match konnte nicht gelöscht werden." }, { status: 500 });
  }
}
