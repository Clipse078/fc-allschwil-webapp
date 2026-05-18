/**
 * canSeeTarget — visibility predicate for Target entities.
 *
 * Now that Target carries VisibilityScope, this delegates directly to
 * canSeeEntity() — the same logic used by Meeting and Initiative.
 *
 * Phase 1 placeholder replaced: Target now supports PRIVATE / RESTRICTED /
 * ORGANISATION scoping on both reads and writes through the centralized
 * requireTargetAccess() guard in visibility-guards.ts.
 *
 * TODO: Four-eye enforcement
 *   When requiresFourEyeReview is true on a Target, APPROVED stage transitions
 *   must require a different actor than the creator. Enforce inside
 *   requireTargetAccess({ access: "stage" }) in visibility-guards.ts.
 *
 * TODO: PermissionModule.TARGETS gating
 *   Once PermissionModule.TARGETS is DB-seeded and permission enforcement is
 *   active, add a permission check inside requireTargetAccess() for write/delete
 *   access modes before the visibility check.
 */

import type { ActorContext } from "./actor-context";
import { canSeeEntity, type VisibilityCheckable } from "./visibility-filter";

/** Shape required to run a visibility check on a Target. */
export type TargetVisibilityShape = VisibilityCheckable;

/**
 * Returns true if actor is allowed to see/access this target.
 *
 * Delegates to canSeeEntity() — same state machine as Meeting and Initiative:
 *   ORGANISATION → always true
 *   creator (any scope) → always true
 *   PRIVATE → creator + visibleUserRefs
 *   RESTRICTED → check visibleRoleRefs, visibleUserRefs
 *                (team/org/person TODOs in visibility-filter.ts)
 */
export function canSeeTarget(
  target: TargetVisibilityShape,
  actor: ActorContext,
): boolean {
  return canSeeEntity(target, actor);
}
