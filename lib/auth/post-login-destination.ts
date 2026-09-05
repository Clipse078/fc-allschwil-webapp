import { PERMISSIONS } from "@/lib/permissions/permissions";

export const DEFAULT_POST_LOGIN_DESTINATION = "/dashboard";
export const PLATFORM_POST_LOGIN_DESTINATION =
  "/dashboard/admin/command-center";

type PostLoginUser = {
  activeTenantId?: string | null;
  isImpersonating?: boolean;
  permissionKeys?: string[];
};

/**
 * Platform-only operators should not enter tenant-oriented dashboard queries
 * without a tenant context. This is an UX routing decision only; the Command
 * Center performs its own live PLATFORM authorization before rendering.
 */
export function resolvePostLoginDestination(
  user: PostLoginUser | null | undefined,
): string {
  if (
    user &&
    !user.isImpersonating &&
    !user.activeTenantId &&
    user.permissionKeys?.some(
      (permission) =>
        permission === PERMISSIONS.TENANTS_VIEW ||
        permission === PERMISSIONS.TENANTS_MANAGE,
    )
  ) {
    return PLATFORM_POST_LOGIN_DESTINATION;
  }

  return DEFAULT_POST_LOGIN_DESTINATION;
}
