/**
 * canSeeTarget — visibility predicate for Target entities.
 *
 * Phase 1: Target does not yet have a VisibilityScope field. All authenticated
 * actors can see all targets. This function exists as a centralised hook so
 * that visibility enforcement on Targets has a single, consistent call site
 * that is easy to upgrade in phase 2.
 *
 * Phase 2 upgrade path:
 *   1. Add `visibilityScope VisibilityScope @default(ORGANISATION)` to the
 *      Target model (same migration pattern as Meeting/Initiative).
 *   2. Add the visibility fields (visibleRoleRefs, visibleUserRefs, etc.).
 *   3. Replace the body of canSeeTarget with:
 *        return canSeeEntity(target, actor);
 *   4. Update TARGET_GUARD_SELECT in visibility-guards.ts to include the
 *      new visibility fields.
 *
 * TODO: VisibilityScope on Target
 *   Strategic targets may eventually contain sensitive information (e.g.
 *   confidential financial goals, personnel objectives). Adding VisibilityScope
 *   to Target follows the same architecture as Meeting/Initiative.
 *
 * TODO: Four-eye enforcement
 *   When requiresFourEyeReview is true on a Target, APPROVED stage transitions
 *   must require a different actor than the creator. Enforce in phase 2 inside
 *   requireTargetAccess({ access: "stage" }).
 */

import type { ActorContext } from "./actor-context";

/** Minimal shape required to run a visibility check on a Target. */
export type TargetVisibilityShape = {
  id: string;
  // No visibilityScope yet — added here when Target gains VisibilityScope.
};

/**
 * Returns true if actor is allowed to see/access this target.
 *
 * Phase 1: always returns true for any authenticated actor.
 * Phase 2: call canSeeEntity(target, actor) once VisibilityScope is on Target.
 */
export function canSeeTarget(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _target: TargetVisibilityShape,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _actor: ActorContext,
): boolean {
  // Phase 1: no VisibilityScope on Target — all authenticated users can access.
  // Replace with canSeeEntity(_target, _actor) in Phase 2.
  return true;
}
