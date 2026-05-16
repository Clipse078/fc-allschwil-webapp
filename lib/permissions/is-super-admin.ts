import type { Session } from "next-auth";

export const SUPER_ADMIN_ROLE_KEY = "super_admin";

export function isSuperAdmin(session: Session | null): boolean {
  return Boolean(
    (session?.user as { roleKeys?: string[] } | undefined)?.roleKeys?.includes(SUPER_ADMIN_ROLE_KEY),
  );
}
