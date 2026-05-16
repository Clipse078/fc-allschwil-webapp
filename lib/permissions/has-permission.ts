import type { Session } from "next-auth";
import type { PermissionKey } from "@/lib/permissions/permissions";
import { isSuperAdmin } from "@/lib/permissions/is-super-admin";

export function hasPermission(
  session: Session | null,
  permissionKey: PermissionKey,
): boolean {
  if (isSuperAdmin(session)) return true;
  if (!session?.user?.permissionKeys?.length) return false;
  return session.user.permissionKeys.includes(permissionKey);
}
