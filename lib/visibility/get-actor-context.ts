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
 * DB-resilient: if OrgUnitMembership table does not yet exist (pre-migration
 * STAGE), the query is caught and orgUnitIds falls back to [] rather than
 * crashing the request. This preserves the documented safe default.
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
 * Also safe when the OrgUnitMembership table does not yet exist (falls back to []).
 */
export async function getActorContext(user: SessionUser) {
  let orgUnitIds: string[] = [];
  try {
    orgUnitIds = await loadOrgUnitIds(user.id);
  } catch {
    // OrgUnitMembership table may not yet exist (pre-migration environment).
    // orgUnitIds: [] is the documented safe default — no org-unit-based
    // visibility grants, which is correct when the table is absent.
  }
  return buildActorContext(user, orgUnitIds);
}
