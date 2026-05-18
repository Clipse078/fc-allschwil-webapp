/**
 * Centralized governance/visibility guards for protected write operations.
 *
 * These guards replace raw `prisma.<model>.findUnique()` calls inside route
 * handlers. They enforce the critical rule:
 *
 *   VISIBILITY MUST BE CHECKED BEFORE ANY WRITE, DELETE, OR STAGE TRANSITION.
 *
 * If an actor cannot see an entity, the entity effectively does not exist for
 * them — 404-masking applies (no 403, to prevent information disclosure).
 *
 * Usage:
 *
 *   const guard = await requireMeetingAccess({ actor, id, access: "write" });
 *   if (!guard.ok) return guard.response;
 *   const { entity } = guard; // entity.reviewStage etc. available
 *
 * Access modes (phase 1 — all enforce visibility; phase 2 will add role/ownership):
 *   "read"   — visibility check only
 *   "write"  — visibility check (phase 2: add ownership / creator-only guard)
 *   "delete" — visibility check (phase 2: add creator-only restriction)
 *   "stage"  — visibility check (phase 2: add four-eye enforcement)
 *
 * Future extensions (RBAC / Organisation Builder):
 *
 * TODO: requiresFourEyeReview enforcement
 *   When entity.requiresFourEyeReview is true and access is "stage" for APPROVE,
 *   block if actor.userId === entity.createdByUserId (self-approval).
 *   Add as a sub-check within these guards once the four-eye rule is activated.
 *
 * TODO: PermissionModule.MEETINGS / INITIATIVES / TARGETS gating
 *   Once permission keys are DB-seeded and enforced, add a permission check
 *   inside each guard before the visibility check:
 *     if (access !== "read" && !actor.permissionKeys.includes("meetings.manage"))
 *       return { ok: false, response: 403 response };
 *
 * TODO: Audit logging
 *   Each guard call is a natural instrumentation point for audit log emission.
 *   Add `logAction({ actor, entity, access, module: "meetings" })` once the
 *   AuditLog integration is wired to these modules.
 *
 * TODO: Org-unit ownership restrictions
 *   Phase 2: certain write operations may be restricted to actors within
 *   the same org unit as the creator. Add orgUnit check after visibility check.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "./actor-context";
import { canSeeEntity } from "./visibility-filter";
import { canSeeTarget } from "./can-see-target";

export type AccessMode = "read" | "write" | "delete" | "stage";

// ---------------------------------------------------------------------------
// Internal select shapes — include all fields needed by callers
// ---------------------------------------------------------------------------

const MEETING_GUARD_SELECT = {
  id: true,
  slug: true,
  reviewStage: true,
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
} as const;

const INITIATIVE_GUARD_SELECT = {
  id: true,
  slug: true,
  reviewStage: true,
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
} as const;

const TARGET_GUARD_SELECT = {
  id: true,
  title: true,
  reviewStage: true,
  // Visibility fields — now present on Target
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
} as const;

// ---------------------------------------------------------------------------
// Guard result types
// ---------------------------------------------------------------------------

type MeetingGuardEntity = {
  id: string;
  slug: string;
  reviewStage: string;
  visibilityScope: string;
  createdByUserId: string | null;
  visibleRoleRefs: unknown;
  visibleUserRefs: unknown;
  visibleTeamRefs: unknown;
  visibleOrgUnitRefs: unknown;
  visiblePersonRefs: unknown;
};

type InitiativeGuardEntity = MeetingGuardEntity; // same shape

type TargetGuardEntity = {
  id: string;
  title: string;
  reviewStage: string;
  visibilityScope: string;
  createdByUserId: string | null;
  visibleRoleRefs: unknown;
  visibleUserRefs: unknown;
  visibleTeamRefs: unknown;
  visibleOrgUnitRefs: unknown;
  visiblePersonRefs: unknown;
};

type GuardSuccess<T> = { ok: true; entity: T };
type GuardFailure = { ok: false; response: NextResponse };
type GuardResult<T> = GuardSuccess<T> | GuardFailure;

// ---------------------------------------------------------------------------
// Internal helper: build 404-masked not-found response
// ---------------------------------------------------------------------------

function notFound(message: string): GuardFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status: 404 }),
  };
}

// ---------------------------------------------------------------------------
// requireMeetingAccess
// ---------------------------------------------------------------------------

/**
 * Fetch a Meeting by id and verify the actor has access.
 *
 * Returns the entity (with reviewStage and visibility fields) on success, or
 * a pre-built 404 NextResponse on failure (not-found or visibility-blocked).
 *
 * Callers MUST NOT call prisma.meeting.findUnique() inside write/delete/stage
 * handlers — use this guard instead.
 */
export async function requireMeetingAccess(opts: {
  actor: ActorContext;
  id: string;
  access: AccessMode;
}): Promise<GuardResult<MeetingGuardEntity>> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: opts.id },
    select: MEETING_GUARD_SELECT,
  });

  if (!meeting) return notFound("Meeting nicht gefunden.");

  // Visibility check — must happen before any access decision
  if (!canSeeEntity(meeting, opts.actor)) {
    return notFound("Meeting nicht gefunden.");
  }

  // TODO: Phase 2 — access-mode-specific checks:
  //   "write" / "delete": block if actor is not creator AND not in an allowed role
  //   "stage": enforce requiresFourEyeReview (block self-approval)
  //   "write": enforce PermissionModule.MEETINGS_MANAGE once seeded

  return { ok: true, entity: meeting };
}

// ---------------------------------------------------------------------------
// requireInitiativeAccess
// ---------------------------------------------------------------------------

/**
 * Fetch an Initiative by id and verify the actor has access.
 *
 * Mirrors requireMeetingAccess exactly — same 404-masking, same phase-1 logic.
 */
export async function requireInitiativeAccess(opts: {
  actor: ActorContext;
  id: string;
  access: AccessMode;
}): Promise<GuardResult<InitiativeGuardEntity>> {
  const initiative = await prisma.initiative.findUnique({
    where: { id: opts.id },
    select: INITIATIVE_GUARD_SELECT,
  });

  if (!initiative) return notFound("Initiative nicht gefunden.");

  if (!canSeeEntity(initiative, opts.actor)) {
    return notFound("Initiative nicht gefunden.");
  }

  // TODO: Phase 2 — access-mode-specific checks (same pattern as Meeting)

  return { ok: true, entity: initiative };
}

// ---------------------------------------------------------------------------
// requireTargetAccess
// ---------------------------------------------------------------------------

/**
 * Fetch a Target by id and verify the actor has access.
 *
 * Phase 1: Target has no VisibilityScope — canSeeTarget() always returns true
 * for authenticated actors. The guard still centralises the lookup so that
 * adding VisibilityScope to Target in Phase 2 requires only:
 *   1. Expand TARGET_GUARD_SELECT with visibility fields.
 *   2. Replace canSeeTarget() with canSeeEntity().
 *
 * All write/delete/stage/links/datapoint handlers on Targets MUST use this
 * guard instead of calling prisma.target.findUnique() directly.
 */
export async function requireTargetAccess(opts: {
  actor: ActorContext;
  id: string;
  access: AccessMode;
}): Promise<GuardResult<TargetGuardEntity>> {
  const target = await prisma.target.findUnique({
    where: { id: opts.id },
    select: TARGET_GUARD_SELECT,
  });

  if (!target) return notFound("Ziel nicht gefunden.");

  // canSeeTarget now delegates to canSeeEntity() — full visibility enforcement
  if (!canSeeTarget(target, opts.actor)) {
    return notFound("Ziel nicht gefunden.");
  }

  // TODO: access-mode-specific checks (same pattern as Meeting/Initiative):
  //   "write" / "delete": block if actor is not creator AND not in allowed role
  //   "stage": enforce requiresFourEyeReview (block self-approval)
  //   "write": enforce PermissionModule.TARGETS_MANAGE once seeded

  return { ok: true, entity: target };
}
