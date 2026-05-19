/**
 * canSeeTarget — visibility predicate for Target entities.
 *
 * Delegates to canSeeEntity() — the same logic used by Meeting and Initiative.
 * Target supports PRIVATE / RESTRICTED / ORGANISATION scoping through
 * requireTargetAccess() in visibility-guards.ts.
 *
 * Roadmap:
 *   - visibleTeamRefs: requires actor.teamIds (not yet in session)
 *   - visiblePersonRefs: requires actor.personId (not yet in session)
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
