import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";

export function hasPermission(
  session: Session | null,
  permissionKey: PermissionKey,
): boolean {
  if (!session?.user?.permissionKeys?.length) {
    return false;
  }

  return session.user.permissionKeys.includes(permissionKey);
}
