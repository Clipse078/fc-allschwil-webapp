import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/has-permission";
import type { PermissionKey } from "@/lib/permissions/permissions";

export async function requirePermission(permissionKey: PermissionKey) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowed = hasPermission(session, permissionKey);

  if (!allowed) {
    redirect("/dashboard");
  }

  return session;
}
