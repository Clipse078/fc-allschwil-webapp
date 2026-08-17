/**
 * Org-unit access helpers — server-only.
 *
 * Centralises the logic that decides whether an actor can access a specific
 * OrgUnit record (detail page, edit page, etc.). Keeps the access rule in one
 * place so it is easy to audit and extend.
 *
 * Design decisions (Phase 2 — Organisation-based Permissions):
 *   - Global ORG_VIEW / ORG_MANAGE permission grants access to all org units
 *     (no change from Phase 1 — admin access is unchanged).
 *   - Active membership in a specific org unit grants access to that unit only.
 *     This is deliberately narrow: belonging to org unit X does NOT grant access
 *     to org unit Y, the list page, or any management operations.
 *   - Write operations (edit, archive, restore) continue to require ORG_MANAGE.
 *   - Membership-based access is read-only by design.
 *
 * Archived org unit rule:
 *   ActorContext.orgUnitIds is already filtered by loadOrgUnitIds() to exclude
 *   archived org units. canAccessOrgUnit() does not need to re-check archival
 *   status — if an ID is not in actor.orgUnitIds, it was either never a member
 *   or the unit is archived.
 */

import type { ActorContext } from "./actor-context";

/** Permission key constants — mirrors PERMISSIONS in lib/permissions/permissions.ts. */
const ORG_PERM = {
  VIEW: "org.view",
  MANAGE: "org.manage",
  DELETE: "org.delete",
} as const;

/**
 * Returns true if the actor can read/view a specific org unit.
 *
 * Access is granted if:
 *   1. The actor holds ORG_VIEW or ORG_MANAGE (global org-unit permission), OR
 *   2. The actor is an active member of this specific org unit (narrow self-service
 *      access — the unit must not be archived, which is enforced in loadOrgUnitIds).
 *
 * This does NOT grant write access. Use canManageOrgUnit() for mutations.
 */
export function canAccessOrgUnit(orgUnitId: string, actor: ActorContext): boolean {
  if (
    actor.permissionKeys.includes(ORG_PERM.VIEW) ||
    actor.permissionKeys.includes(ORG_PERM.MANAGE)
  ) {
    return true;
  }
  return actor.orgUnitIds.includes(orgUnitId);
}

/**
 * Returns true if the actor can manage (create, edit, archive, restore, delete)
 * org unit records.
 *
 * Deliberately only checks ORG_MANAGE — org unit membership alone does not
 * grant write access. This prevents broad privilege escalation.
 */
export function canManageOrgUnit(actor: ActorContext): boolean {
  return actor.permissionKeys.includes(ORG_PERM.MANAGE);
}

/**
 * Returns true if the actor can permanently delete an OrgUnit.
 * Requires ORG_DELETE — deliberately separate from ORG_MANAGE.
 */
export function canDeleteOrgUnit(actor: ActorContext): boolean {
  return actor.permissionKeys.includes(ORG_PERM.DELETE);
}

/**
 * Returns true if the actor can list/browse org units.
 *
 * This is a module-level gate. Org-unit membership alone does not grant
 * access to the full list — that would expose all org units to all members.
 * The list is only available to users with explicit ORG_VIEW or ORG_MANAGE.
 */
export function canListOrgUnits(actor: ActorContext): boolean {
  return (
    actor.permissionKeys.includes(ORG_PERM.VIEW) ||
    actor.permissionKeys.includes(ORG_PERM.MANAGE)
  );
}
