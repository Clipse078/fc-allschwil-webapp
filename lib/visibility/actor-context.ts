/**
 * ActorContext — lightweight representation of the currently authenticated user
 * for visibility/access control decisions.
 *
 * Derived from the NextAuth session object. Only includes fields that are
 * available in the current session shape; future fields are TODOs.
 *
 * TODO: personId
 *   When a User ↔ Person FK is added (e.g. User.personId), include personId here
 *   so visiblePersonRefs can be checked against it.
 *
 * TODO: teamIds
 *   When user ↔ team membership is queryable at session time (e.g. cached on JWT),
 *   include teamIds here so visibleTeamRefs can be checked without a DB lookup.
 *   Alternative: lazy DB query at visibility check time (one extra query per request).
 *
 * TODO: orgUnitIds
 *   When an OrgUnit model exists and user membership is established, add orgUnitIds
 *   so visibleOrgUnitRefs can be evaluated.
 */

export type ActorContext = {
  /** User.id from session — the primary identity key for visibility checks. */
  userId: string;
  /** Role keys from session (e.g. ["super_admin", "board_member"]). */
  roleKeys: string[];
  /** Permission keys from session — may be used for module-level gates. */
  permissionKeys: string[];
  // TODO: personId?: string
  // TODO: teamIds?: string[]
  // TODO: orgUnitIds?: string[]
};

type SessionUser = {
  id: string;
  roleKeys: string[];
  permissionKeys: string[];
};

/** Derive an ActorContext from a validated session user object. */
export function buildActorContext(user: SessionUser): ActorContext {
  return {
    userId: user.id,
    roleKeys: user.roleKeys ?? [],
    permissionKeys: user.permissionKeys ?? [],
  };
}
