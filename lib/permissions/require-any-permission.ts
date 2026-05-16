import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import type { PermissionKey } from "@/lib/permissions/permissions";

export async function requireAnyPermission(permissionKeys: PermissionKey[]) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowed = hasAnyPermission(session, permissionKeys);

  if (!allowed) {
    redirect("/dashboard");
  }

  return session;
}
