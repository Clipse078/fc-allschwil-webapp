import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";

/**
 * Fast, synchronous "any of" check against the session-cached
 * `permissionKeys` array. See hasPermission() for the resolution model and
 * its intended (non-authoritative) use.
 */
export function hasAnyPermission(
  session: Session | null,
  permissionKeys: PermissionKey[],
): boolean {
  if (!session?.user?.permissionKeys?.length || permissionKeys.length === 0) {
    return false;
  }

  return permissionKeys.some(function (permissionKey) {
    return session.user.permissionKeys.includes(permissionKey);
  });
}
