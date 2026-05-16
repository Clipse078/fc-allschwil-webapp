import type { Session } from "next-auth";

export const SUPER_ADMIN_ROLE_KEY = "super_admin";

/** Returns true if the session belongs to a super_admin role holder.
 *  roleKeys is populated from DB on every login and stored in the JWT —
 *  it is never slimmed out by the current auth.ts implementation.
 */
export function isSuperAdmin(session: Session | null): boolean {
  return Boolean(session?.user?.roleKeys?.includes(SUPER_ADMIN_ROLE_KEY));
}
