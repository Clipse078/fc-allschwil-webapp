/**
 * Centralized governance/visibility guards for protected write operations.
 *
 * Enforcement order (mandatory — do not reorder):
 *   1. Visibility check   → 404-mask if actor cannot see the entity
 *   2. Permission check   → 403 Forbidden if actor lacks the required key
 *   3. Action logic       → proceed with write/delete/stage
 *
 * This ordering is critical:
 *   - 404-masking prevents information disclosure (existence of PRIVATE records)
 *   - 403 only surfaces once the entity is confirmed visible — no leakage
 *
 * Access modes:
 *   "read"   → requires view OR manage permission
 *   "write"  → requires manage permission
 *   "delete" → requires manage permission
 *   "stage"  → requires manage permission
 *
 * Permission key mapping (matches PERMISSIONS constants + DB seed):
 *   Meetings    → meetings.view / meetings.manage
 *   Initiatives → initiatives.view / initiatives.manage
 *   Targets     → targets.view / targets.manage
 *
 * Future TODOs:
 *
 * TODO: requiresFourEyeReview enforcement (Phase B)
 *   When entity.requiresFourEyeReview is true and access is "stage" targeting
 *   APPROVED/PUBLISHED, block if actor.userId === entity.createdByUserId.
 *   This is the four-eye check: creator cannot self-approve.
 *
 * TODO: Org-unit ownership restrictions (Phase B)
 *   Add org-unit membership check after permission check for write/delete
 *   to restrict edits to actors within the same org unit as the creator.
 *
 * TODO: Audit logging (Phase A remaining)
 *   Each guard call is a natural instrumentation point. Log { actor, entity,
 *   access, module, timestamp } to AuditLog after successful access grant.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "./actor-context";
import { canSeeEntity } from "./visibility-filter";
import { canSeeTarget } from "./can-see-target";

export type AccessMode = "read" | "write" | "delete" | "stage";

// ---------------------------------------------------------------------------
// Permission key constants (mirror lib/permissions/permissions.ts)
// ---------------------------------------------------------------------------

const PERM = {
  MEETINGS_VIEW: "meetings.view",
  MEETINGS_MANAGE: "meetings.manage",
  INITIATIVES_VIEW: "initiatives.view",
  INITIATIVES_MANAGE: "initiatives.manage",
  TARGETS_VIEW: "targets.view",
  TARGETS_MANAGE: "targets.manage",
} as const;

// ---------------------------------------------------------------------------
// Internal permission check helpers
// ---------------------------------------------------------------------------

function hasPermission(actor: ActorContext, ...keys: string[]): boolean {
  return keys.some((k) => actor.permissionKeys.includes(k));
}

function forbidden(message: string): GuardFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status: 403 }),
  };
}

// ---------------------------------------------------------------------------
// Internal select shapes
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
// Internal helpers
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
 * Guard for Meeting write/delete/stage operations.
 *
 * Enforcement order:
 *   1. Visibility → 404-mask invisible records
 *   2. Permission → 403 if actor lacks meetings.view (read) or meetings.manage (write/delete/stage)
 *
 * Note: read access via GET /api/meetings/[id] uses getMeetingById() directly
 * (not this guard). Permission on reads is checked there via session auth only
 * for now. Future: route all reads through this guard for full enforcement.
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

  // Step 1: 404-mask — invisible entities must not exist for the actor
  if (!meeting) return notFound("Meeting nicht gefunden.");
  if (!canSeeEntity(meeting, opts.actor)) {
    return notFound("Meeting nicht gefunden.");
  }

  // Step 2: permission check — only after visibility is confirmed
  if (opts.access === "read") {
    if (!hasPermission(opts.actor, PERM.MEETINGS_VIEW, PERM.MEETINGS_MANAGE)) {
      return forbidden("meetings.view Berechtigung erforderlich.");
    }
  } else {
    // write / delete / stage
    if (!hasPermission(opts.actor, PERM.MEETINGS_MANAGE)) {
      return forbidden("meetings.manage Berechtigung erforderlich.");
    }
  }

  // TODO: Phase B — requiresFourEyeReview: block self-approval on "stage"
  // TODO: Phase B — audit log emission

  return { ok: true, entity: meeting };
}

// ---------------------------------------------------------------------------
// requireInitiativeAccess
// ---------------------------------------------------------------------------

/**
 * Guard for Initiative write/delete/stage operations.
 * Mirrors requireMeetingAccess — same ordering and pattern.
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

  if (opts.access === "read") {
    if (!hasPermission(opts.actor, PERM.INITIATIVES_VIEW, PERM.INITIATIVES_MANAGE)) {
      return forbidden("initiatives.view Berechtigung erforderlich.");
    }
  } else {
    if (!hasPermission(opts.actor, PERM.INITIATIVES_MANAGE)) {
      return forbidden("initiatives.manage Berechtigung erforderlich.");
    }
  }

  // TODO: Phase B — requiresFourEyeReview + audit log

  return { ok: true, entity: initiative };
}

// ---------------------------------------------------------------------------
// requireTargetAccess
// ---------------------------------------------------------------------------

/**
 * Guard for Target read/write/delete/stage/links/datapoints operations.
 *
 * Unlike Meeting/Initiative, the GET /api/targets/[id] also uses this guard
 * (access: "read"), so read permission is enforced here too.
 *
 * Enforcement order:
 *   1. Visibility → 404-mask
 *   2. Permission → 403 if actor lacks targets.view (read) or targets.manage (write+)
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
  if (!canSeeTarget(target, opts.actor)) {
    return notFound("Ziel nicht gefunden.");
  }

  if (opts.access === "read") {
    if (!hasPermission(opts.actor, PERM.TARGETS_VIEW, PERM.TARGETS_MANAGE)) {
      return forbidden("targets.view Berechtigung erforderlich.");
    }
  } else {
    // write / delete / stage — links and datapoints also route through "write"
    if (!hasPermission(opts.actor, PERM.TARGETS_MANAGE)) {
      return forbidden("targets.manage Berechtigung erforderlich.");
    }
  }

  // TODO: Phase B — requiresFourEyeReview + audit log

  return { ok: true, entity: target };
}
