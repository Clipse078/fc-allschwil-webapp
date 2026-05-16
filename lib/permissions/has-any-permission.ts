import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";

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
