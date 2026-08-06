import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * Fast, synchronous permission check against the session-cached
 * `permissionKeys` array — the union of the user's PLATFORM permissions and
 * their TENANT permissions for `session.user.activeTenantId`, computed by
 * the RPERM-03 EffectivePermissionResolver at sign-in (see
 * lib/auth/session-context.ts). Correctly scoped: a platform role never
 * contributes tenant-only permissions here, and tenant grants never leak
 * across tenants.
 *
 * Use this ONLY for optional UI decisions (show/hide a button, nav item,
 * etc.) where the cost of a stale-until-next-login value is acceptable. It
 * is NOT the authorization boundary — for actual access control, use
 * requirePermission() / requireApiPermission(), which evaluate
 * `(permission, tenant)` live against the resolver.
 */
export function hasPermission(
  session: Session | null,
  permissionKey: PermissionKey,
): boolean {
  if (!session?.user?.permissionKeys?.length) {
    return false;
  }

  return session.user.permissionKeys.includes(permissionKey);
}
