import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions/has-permission";
import type { PermissionKey } from "@/lib/permissions/permissions";

export async function requireApiPermission(permissionKey: PermissionKey) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
    };
  }

  if (!hasPermission(session, permissionKey)) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      session,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
    session,
  };
}
