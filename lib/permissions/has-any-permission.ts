import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { isSuperAdmin } from "@/lib/permissions/is-super-admin";

export function hasAnyPermission(
  session: Session | null,
  permissionKeys: PermissionKey[],
): boolean {
  if (isSuperAdmin(session)) return true;
  if (!session?.user?.permissionKeys?.length || permissionKeys.length === 0) return false;
  return permissionKeys.some((p) => session.user.permissionKeys.includes(p));
}
