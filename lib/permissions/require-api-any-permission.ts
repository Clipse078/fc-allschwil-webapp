import { auth } from "@/auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import type { PermissionKey } from "@/lib/permissions/permissions";

export async function requireApiAnyPermission(permissionKeys: PermissionKey[]) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      session: null,
    };
  }

  const allowed = hasAnyPermission(session, permissionKeys);

  if (!allowed) {
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
