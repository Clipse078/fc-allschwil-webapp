/**
 * ActorContext — lightweight representation of the currently authenticated user
 * for visibility/access control decisions.
 *
 * Derived from session + optional async DB enrichment (org unit memberships).
 *
 * TODO: personId
 *   When a User ↔ Person FK is added, include personId so visiblePersonRefs
 *   can be checked.
 *
 * TODO: teamIds
 *   When user ↔ team membership is queryable at session time (or cached in JWT),
 *   include teamIds so visibleTeamRefs can be checked without a DB lookup.
 *
 * TODO: cache orgUnitIds in JWT
 *   Currently loaded via loadOrgUnitIds() on each relevant request. Cache in
 *   JWT at login time to avoid per-request DB queries.
 */

export type ActorContext = {
  /** User.id from session — the primary identity key for visibility checks. */
  userId: string;
  /** Role keys from session (e.g. ["super_admin", "board_member"]). */
  roleKeys: string[];
  /** Permission keys from session — may be used for module-level gates. */
  permissionKeys: string[];
  /**
   * OrgUnit IDs the actor is an active member of.
   * Populated by loadOrgUnitIds(userId) when org-unit visibility is needed.
   * Defaults to [] when not loaded (safe — no false-positive visibility grants).
   */
  orgUnitIds: string[];
  // TODO: personId?: string
  // TODO: teamIds?: string[]
};

type SessionUser = {
  id: string;
  roleKeys: string[];
  permissionKeys: string[];
};

/** Derive a base ActorContext from a session user object. orgUnitIds defaults to []. */
export function buildActorContext(
  user: SessionUser,
  orgUnitIds: string[] = [],
): ActorContext {
  return {
    userId: user.id,
    roleKeys: user.roleKeys ?? [],
    permissionKeys: user.permissionKeys ?? [],
    orgUnitIds,
  };
}
