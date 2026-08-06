/**
 * lib/roles/tenant-role-keys.ts
 *
 * RPERM-05-C1 — Single canonical source for the per-tenant materialized
 * Club Admin role key.
 *
 * Before this fix, `prisma/seed.ts` and
 * `scripts/rperm-03b-bootstrap-admin-separation.ts` independently
 * constructed two different role keys for the same tenant/role identity
 * (`club_admin__fc-allschwil` vs. `club_admin_fc_allschwil`), producing two
 * divergent `Role` rows for "FC Allschwil Club Admin" — only one of which
 * carried `isSystem: true` protection. Every caller that needs the
 * materialized tenant Club Admin role key (seed, bootstrap scripts, tenant
 * role materialization, consolidation tooling, tests) MUST import
 * `getTenantClubAdminRoleKey` from here instead of constructing the string
 * itself.
 *
 * The chosen canonical identity is the one already produced by RPERM-04's
 * tenant-role materialization step in `prisma/seed.ts`
 * (`club_admin__<tenantKey>`) — the accepted architecture for
 * per-tenant-materialized system roles.
 */

/** The PLATFORM-scoped template role key every tenant Club Admin role is materialized from. */
export const CLUB_ADMIN_TEMPLATE_KEY = "club_admin";

/**
 * Deterministic, tenant-safe key for the per-tenant materialized Club Admin
 * role. Pure function — same `tenantKey` always yields the same result, and
 * different tenant keys can never collide (the `Role.key` unique
 * constraint enforces one canonical row per tenant across the whole table).
 */
export function getTenantClubAdminRoleKey(tenantKey: string): string {
  const trimmed = tenantKey.trim();
  if (!trimmed) {
    throw new Error("getTenantClubAdminRoleKey: tenantKey must be a non-empty string.");
  }
  return `${CLUB_ADMIN_TEMPLATE_KEY}__${trimmed}`;
}
