/**
 * Visibility filter helpers — server-only.
 *
 * Implements the VisibilityScope state machine:
 *   ORGANISATION → visible to all authenticated users in the system
 *   RESTRICTED   → visible only to users matching at least one allowlist set
 *   PRIVATE      → visible only to the creator + explicit user allowlist
 *
 * Phase 1 strategy:
 *   - ORGANISATION records: included by DB WHERE clause.
 *   - RESTRICTED records: fetched from DB (all of them), filtered in-app via
 *     canSeeEntity(). This avoids complex JSONB array-overlap SQL.
 *   - PRIVATE records: only creator's records fetched from DB (WHERE createdByUserId).
 *     In-app check additionally validates explicit visibleUserRefs allowlist.
 *
 * Phase 1 known limitation:
 *   PRIVATE records where the actor is in visibleUserRefs but is NOT the creator
 *   are NOT returned (the DB WHERE clause excludes them). This is documented
 *   as a safe conservative default — fix in Phase 2 with a JSONB @> query.
 *
 * 404-masking principle:
 *   When an actor requests a record they cannot see, callers must return null
 *   (rendered as "not found"), NOT a 403 — to avoid disclosing the record's
 *   existence to unauthorised users.
 */

import { VisibilityScope } from "@prisma/client";
import type { ActorContext } from "./actor-context";

/** Any entity that carries visibility fields. */
export type VisibilityCheckable = {
  visibilityScope: VisibilityScope;
  createdByUserId: string | null;
  visibleRoleRefs: unknown;
  visibleUserRefs: unknown;
  visibleTeamRefs: unknown;
  visibleOrgUnitRefs: unknown;
  visiblePersonRefs: unknown;
};

/** Parse a JSONB field that stores a plain string[]. */
function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/**
 * Returns true if the actor is allowed to see this entity.
 *
 * Call this after fetching from DB to filter RESTRICTED records.
 * ORGANISATION and creator-owned PRIVATE records are pre-filtered at DB level.
 */
export function canSeeEntity(entity: VisibilityCheckable, actor: ActorContext): boolean {
  if (entity.visibilityScope === VisibilityScope.ORGANISATION) return true;

  // Creator always sees their own records regardless of scope
  if (entity.createdByUserId && entity.createdByUserId === actor.userId) return true;

  if (entity.visibilityScope === VisibilityScope.PRIVATE) {
    // PRIVATE: creator (handled above) + explicit user allowlist only
    const userIds = parseStringArray(entity.visibleUserRefs);
    return userIds.includes(actor.userId);
  }

  // RESTRICTED: check each allowlist
  const roleKeys = parseStringArray(entity.visibleRoleRefs);
  if (roleKeys.some((k) => actor.roleKeys.includes(k))) return true;

  const userIds = parseStringArray(entity.visibleUserRefs);
  if (userIds.includes(actor.userId)) return true;

  // TODO: team membership check — requires actor.teamIds (not yet in session)
  // const teamIds = parseStringArray(entity.visibleTeamRefs);
  // if (teamIds.some(id => actor.teamIds?.includes(id))) return true;

  // TODO: orgUnit membership check — requires actor.orgUnitIds (not yet in session)
  // const orgUnitIds = parseStringArray(entity.visibleOrgUnitRefs);
  // if (orgUnitIds.some(id => actor.orgUnitIds?.includes(id))) return true;

  // TODO: person ID check — requires actor.personId (not yet in session)
  // const personIds = parseStringArray(entity.visiblePersonRefs);
  // if (actor.personId && personIds.includes(actor.personId)) return true;

  return false;
}

/**
 * Prisma-compatible WHERE clause that pre-filters at DB level:
 *   - ORGANISATION records: always included
 *   - RESTRICTED records: all fetched, canSeeEntity() applied in-app
 *   - PRIVATE records: only those created by the actor
 *
 * Apply canSeeEntity() to the result set after fetching to finalize filtering.
 */
export function buildVisibilityWhere(actor: ActorContext) {
  return {
    OR: [
      { visibilityScope: VisibilityScope.ORGANISATION },
      { visibilityScope: VisibilityScope.RESTRICTED },
      {
        visibilityScope: VisibilityScope.PRIVATE,
        createdByUserId: actor.userId,
      },
    ],
  };
}

/** Filter an array of fetched entities, removing those invisible to actor. */
export function applyVisibilityFilter<T extends VisibilityCheckable>(
  entities: T[],
  actor: ActorContext,
): T[] {
  return entities.filter((e) => canSeeEntity(e, actor));
}
