/**
 * ActorContext — lightweight representation of the currently authenticated user
 * for visibility/access control decisions.
 *
 * Derived from session + async DB enrichment (org unit memberships, target groups).
 *
 * Phase D: targetGroupIds added — IDs of TargetGroups the actor is a resolved
 * member of. Used by canSeeEntity() to check visibleTargetGroupRefs.
 *
 * TODO: personId
 *   When a User ↔ Person FK is added, include personId so visiblePersonRefs
 *   can be checked and passed to loadOrgUnitIds for person-based memberships.
 *
 * TODO: teamIds
 *   When user ↔ team membership is queryable at session time (or cached in JWT),
 *   include teamIds so visibleTeamRefs can be checked without a DB lookup.
 *
 * TODO: cache orgUnitIds + targetGroupIds in JWT
 *   Currently loaded via DB on each relevant request. Cache in JWT at login
 *   time to avoid per-request DB queries.
 */

export type ActorContext = {
  /** User.id from session — the primary identity key for visibility checks. */
  userId: string;
  /** Role keys from session (e.g. ["super_admin", "board_member"]). */
  roleKeys: string[];
  /** Permission keys from session — may be used for module-level gates. */
  permissionKeys: string[];
  /**
   * OrgUnit IDs the actor is an active, non-expired member of.
   * Populated by loadOrgUnitIds(userId) when org-unit visibility is needed.
   * Defaults to [] when not loaded (safe — no false-positive visibility grants).
   */
  orgUnitIds: string[];
  /**
   * Phase D: TargetGroup IDs the actor is a resolved member of.
   * Used to evaluate visibleTargetGroupRefs on visibility-gated entities.
   * Defaults to [] when not loaded (safe — no false-positive grants).
   */
  targetGroupIds: string[];
  // TODO: personId?: string
  // TODO: teamIds?: string[]
};

type SessionUser = {
  id: string;
  roleKeys: string[];
  permissionKeys: string[];
};

/** Derive a base ActorContext from a session user object. orgUnitIds and targetGroupIds default to []. */
export function buildActorContext(
  user: SessionUser,
  orgUnitIds: string[] = [],
  targetGroupIds: string[] = [],
): ActorContext {
  return {
    userId: user.id,
    roleKeys: user.roleKeys ?? [],
    permissionKeys: user.permissionKeys ?? [],
    orgUnitIds,
    targetGroupIds,
  };
}
