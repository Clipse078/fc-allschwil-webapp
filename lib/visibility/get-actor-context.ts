/**
 * getActorContext — async actor factory that hydrates orgUnitIds from DB.
 *
 * Use this instead of buildActorContext() in any server component or route
 * handler that runs visibility-filtered queries or centralized guards.
 * The orgUnitIds are required to evaluate visibleOrgUnitRefs on RESTRICTED
 * entities.
 *
 * Pattern:
 *   const actor = await getActorContext(session.user);
 *   // or inside an API route:
 *   const actor = await getActorContext(check.session.user);
 *
 * Backwards-compatible: if the user has no org unit memberships, orgUnitIds
 * defaults to [] — no false-positive visibility grants.
 *
 * TODO: replace the DB query with a JWT-cached value once membership is
 *   included in the session token. Until then, this is one extra DB query
 *   per request on visibility-gated endpoints.
 */

import { buildActorContext } from "./actor-context";
import { loadOrgUnitIds } from "@/lib/org/queries";

type SessionUser = {
  id: string;
  roleKeys: string[];
  permissionKeys: string[];
};

/**
 * Build a fully-hydrated ActorContext, including orgUnitIds from DB.
 * Safe to call even if the user has no memberships — returns [] in that case.
 */
export async function getActorContext(user: SessionUser) {
  const orgUnitIds = await loadOrgUnitIds(user.id);
  return buildActorContext(user, orgUnitIds);
}
