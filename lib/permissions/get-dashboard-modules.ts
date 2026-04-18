import type { Session } from "next-auth";
import { hasAnyPermission } from "@/lib/permissions/has-any-permission";
import { ADMIN_MODULES } from "@/lib/permissions/admin-modules";

export function getVisibleDashboardModules(session: Session | null) {
  return ADMIN_MODULES.map((module) => {
    const isVisible =
      !module.requiredPermissions ||
      hasAnyPermission(session, module.requiredPermissions);

    return {
      ...module,
      isVisible,
    };
  });
}
