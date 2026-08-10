/**
 * RPERM-03 — Effective Permission Resolver
 *
 * Canonical backend authorization service that determines whether a user holds
 * a specific permission, either at platform level or within a specific tenant.
 *
 * ── Responsibility ────────────────────────────────────────────────────────────
 * Resolves the union of permissions a user holds by traversing:
 *   UserRole → Role → RolePermission → Permission
 *
 * It enforces:
 *   • Platform vs. tenant scope boundaries
 *   • Exact tenant isolation (Tenant A cannot authorize Tenant B)
 *   • Role and membership validity (archived roles and inactive memberships excluded)
 *   • Fail-closed behavior for all invalid or incomplete authorization paths
 *
 * ── Platform Permissions ─────────────────────────────────────────────────────
 * Granted only when ALL of the following hold:
 *   1. The permission has scope = PLATFORM in the database.
 *   2. The user has a UserRole with no tenant context (tenantId IS NULL).
 *   3. The assigned role has scope = PLATFORM and isArchived = false.
 *   4. The role includes the requested permission.
 *
 * Tenant roles NEVER satisfy a platform permission check.
 * A role with scope = PLATFORM but tenantId ≠ null is inconsistent data
 * and must not act as a platform role.
 *
 * ── Tenant Permissions ───────────────────────────────────────────────────────
 * Granted only when ALL of the following hold:
 *   1. A valid tenantId is supplied by the caller.
 *   2. The permission has scope = TENANT in the database.
 *   3. The user has an active TenantMembership for that exact tenant.
 *   4. The related Tenant itself is operationally ACTIVE (RPERM-04-C1 — an
 *      active membership linked to an ARCHIVED or INACTIVE tenant grants no
 *      permissions; archival/deactivation must take effect immediately for
 *      every live authorization check, not just at next sign-in).
 *   5. The user has a UserRole scoped to that exact tenant (UserRole.tenantId = tenantId).
 *   6. The assigned role has scope = TENANT, tenantId = requested tenantId, and isArchived = false.
 *   7. The role includes the requested permission.
 *
 * Role ownership is enforced: a TENANT role whose tenantId does not match
 * the requested tenant must not grant permissions in that tenant, even when
 * UserRole.tenantId matches. This guards against inconsistent data.
 *
 * Platform roles do NOT implicitly satisfy tenant operational permission checks.
 * A role membership from Tenant A does NOT authorize access in Tenant B.
 *
 * ── Fail-Closed Behavior ─────────────────────────────────────────────────────
 * Every method returns false / empty result when:
 *   • The user does not exist.
 *   • No applicable membership or role exists.
 *   • The tenant does not exist or does not match the membership.
 *   • The role is archived.
 *   • The tenant membership is inactive.
 *   • The permission is unknown or scope-incompatible.
 *   • A required tenantId is missing for a tenant-scoped check.
 *
 * Infrastructure failures (database outages, etc.) propagate as exceptions
 * following the repository's existing server-error conventions.
 * They are NEVER silently converted into permission grants.
 *
 * ── Aggregate Method Semantics ────────────────────────────────────────────────
 *   hasAnyPermission([])  → false   (no permission can be satisfied)
 *   hasAllPermissions([]) → true    (vacuously — all zero requirements met)
 *
 * ── Caching ──────────────────────────────────────────────────────────────────
 * No caching is introduced. Correctness and revocation safety take precedence.
 * Request-scoped memoization may be added in a future RPERM slice.
 *
 * ── Deferred Work ────────────────────────────────────────────────────────────
 * The following are intentionally NOT part of RPERM-03:
 *   • Roles & Permissions management UI
 *   • Tenant custom-role CRUD
 *   • Broad API route migration to this resolver
 *   • Platform override / super-admin impersonation
 *   • Permission caching infrastructure
 *   • Automatic operational role assignment
 *   • Org-unit / team / target-group permission inheritance
 *
 * ── ADMIN-DELETE-01A-C1 — SCE Super Admin cross-tenant deletion authority ────
 * `hasPermission`/`hasAnyPermission`/`hasAllPermissions`/`getEffectivePermissions`
 * above are UNCHANGED by this correction: a PLATFORM-held permission still
 * never satisfies a TENANT-scoped check through those methods — that rule
 * remains correct for every ordinary "view"/"manage" permission and is the
 * exact bug RPERM-04 fixed.
 *
 * `hasTenantDeletionAuthority()` (below) is a separate, narrowly-scoped
 * authorization primitive reserved for "<module>.delete"-convention
 * permissions only. It adds exactly one additional grant path on top of the
 * existing tenant-scoped one: a user holding the same permission key at
 * PLATFORM scope (the SCE Super Admin's platform-wide grant) is authorized
 * against an explicit tenant once that tenant is confirmed to be real and
 * operationally ACTIVE — without requiring a TenantMembership or a
 * tenant-scoped role grant in that tenant. See the method's own doc comment
 * for the full contract and the caller obligations it depends on.
 */

import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Public input/output types
// ---------------------------------------------------------------------------

/**
 * Parameters for a single permission check.
 *
 * When `tenantId` is omitted (or undefined) the check is treated as a
 * platform-scoped check. Supplying a `tenantId` triggers a tenant-scoped
 * check against exactly that tenant.
 */
export interface HasPermissionParams {
  userId: string;
  permission: string;
  tenantId?: string;
}

/** Parameters for an "at least one" permission check. */
export interface HasAnyPermissionParams {
  userId: string;
  permissions: readonly string[];
  tenantId?: string;
}

/** Parameters for a "must hold all" permission check. */
export interface HasAllPermissionsParams {
  userId: string;
  permissions: readonly string[];
  tenantId?: string;
}

/** Parameters for listing all effective permissions. */
export interface GetEffectivePermissionsParams {
  userId: string;
  tenantId?: string;
}

/**
 * Structured result returned by {@link EffectivePermissionResolver.getEffectivePermissions}.
 *
 * Note: `platform` and `tenant` are readonly arrays rather than `Set` so
 * they are safe to serialize in JSON-facing contexts.
 */
export interface EffectivePermissionsResult {
  /** Permission keys granted through platform-scoped roles. */
  readonly platform: readonly string[];
  /** Permission keys granted through tenant-scoped roles for the requested tenant. */
  readonly tenant: readonly string[];
}

// ---------------------------------------------------------------------------
// Internal query helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the deduplicated set of PLATFORM-scoped permission keys for a user.
 *
 * Query strategy: one `findMany` on UserRole, joining role → rolePermissions →
 * permission. Tenant context is never included — platform assignments must
 * have no UserRole.tenantId set.
 *
 * Filters applied at database level:
 *   • userId = <userId>
 *   • UserRole.tenantId IS NULL   (platform assignment, not tenant-specific)
 *   • role.scope = PLATFORM
 *   • role.tenantId IS NULL       (platform roles must not be tenant-owned)
 *   • role.isArchived = false
 *   • permission.scope = PLATFORM
 */
async function resolvePlatformPermissions(
  prisma: PrismaClient,
  userId: string,
): Promise<Set<string>> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId: null,
      role: {
        scope: "PLATFORM",
        tenantId: null,
        isArchived: false,
      },
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: {
              permission: {
                select: {
                  key: true,
                  scope: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const keys = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      if (rp.permission.scope === "PLATFORM") {
        keys.add(rp.permission.key);
      }
    }
  }
  return keys;
}

/**
 * Fetches the deduplicated set of TENANT-scoped permission keys for a user
 * within one specific tenant.
 *
 * Precondition: caller has already verified tenantId is a non-empty string.
 *
 * Query strategy:
 *   1. Verify active TenantMembership for (userId, tenantId).
 *   2. If active, fetch UserRoles scoped to that tenant, joining
 *      role → rolePermissions → permission.
 *
 * Filters applied at database level:
 *   • TenantMembership.tenantId = tenantId AND userId = userId AND isActive = true
 *   • UserRole.userId = userId AND UserRole.tenantId = tenantId
 *   • role.scope = TENANT AND role.tenantId = tenantId AND role.isArchived = false
 *   • permission.scope = TENANT
 *
 * Role ownership enforcement: role.tenantId = tenantId ensures a role that
 * belongs to Tenant B cannot be used to authorize access in Tenant A, even
 * when UserRole.tenantId is set correctly. This closes the inconsistent-data
 * attack vector without requiring schema-level constraints.
 *
 * Tenant operational status (RPERM-04-C1): an active TenantMembership is
 * necessary but not sufficient — the related Tenant must also be
 * operationally ACTIVE (not ARCHIVED, not INACTIVE). This is evaluated live
 * on every call (never cached), so archiving a tenant immediately revokes
 * every tenant permission for every member, regardless of any JWT session
 * that was issued before the archival.
 */
async function resolveTenantPermissions(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
): Promise<Set<string>> {
  // Step 1: verify active tenant membership AND that the tenant itself is
  // operationally active. A membership row being `isActive: true` says
  // nothing about the tenant's own status — both must hold.
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true, tenant: { select: { status: true } } },
  });

  if (!membership?.isActive || membership.tenant.status !== "ACTIVE") {
    return new Set<string>();
  }

  // Step 2: resolve role permissions for this tenant.
  // role.tenantId = tenantId ensures the role is actually owned by this tenant,
  // not just referenced via a cross-tenant UserRole assignment.
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId,
      role: {
        scope: "TENANT",
        tenantId,
        isArchived: false,
      },
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: {
              permission: {
                select: {
                  key: true,
                  scope: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const keys = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      if (rp.permission.scope === "TENANT") {
        keys.add(rp.permission.key);
      }
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Resolver class
// ---------------------------------------------------------------------------

/**
 * Resolves effective permissions for a user, respecting scope, tenant
 * isolation, role validity, and membership validity.
 *
 * Construct with a `PrismaClient` instance. In production, use the
 * application singleton from `lib/db/prisma`. In tests, pass a mock client.
 */
export class EffectivePermissionResolver {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns `true` if and only if the user holds the given permission.
   *
   * When `tenantId` is omitted, performs a platform-scoped check.
   * When `tenantId` is provided, performs a tenant-scoped check for that
   * exact tenant.
   *
   * Fails closed: returns `false` for any missing, inactive, or incompatible
   * authorization path.
   */
  async hasPermission(params: HasPermissionParams): Promise<boolean> {
    const { userId, permission, tenantId } = params;

    if (!userId || !permission) return false;

    if (tenantId) {
      const keys = await resolveTenantPermissions(this.prisma, userId, tenantId);
      return keys.has(permission);
    }

    const keys = await resolvePlatformPermissions(this.prisma, userId);
    return keys.has(permission);
  }

  /**
   * Returns `true` if the user holds at least one of the listed permissions.
   *
   * `hasAnyPermission([], ...)` → `false` (empty input can never be satisfied).
   */
  async hasAnyPermission(params: HasAnyPermissionParams): Promise<boolean> {
    const { userId, permissions, tenantId } = params;

    if (!userId || permissions.length === 0) return false;

    if (tenantId) {
      const keys = await resolveTenantPermissions(this.prisma, userId, tenantId);
      return permissions.some((p) => keys.has(p));
    }

    const keys = await resolvePlatformPermissions(this.prisma, userId);
    return permissions.some((p) => keys.has(p));
  }

  /**
   * Returns `true` only if the user holds every listed permission.
   *
   * `hasAllPermissions([], ...)` → `true` (vacuous truth — all zero
   * requirements are satisfied). Add a test to assert this behavior is
   * intentional if you change it.
   */
  async hasAllPermissions(params: HasAllPermissionsParams): Promise<boolean> {
    const { userId, permissions, tenantId } = params;

    if (!userId) return false;
    if (permissions.length === 0) return true;

    if (tenantId) {
      const keys = await resolveTenantPermissions(this.prisma, userId, tenantId);
      return permissions.every((p) => keys.has(p));
    }

    const keys = await resolvePlatformPermissions(this.prisma, userId);
    return permissions.every((p) => keys.has(p));
  }

  /**
   * ADMIN-DELETE-01A-C1 — SCE Super Admin cross-tenant deletion authority.
   *
   * Reusable authorization primitive for every current and future
   * "<module>.delete" permission (teams.delete is the first instance).
   * Resolves whether `userId` may exercise `permission` against the
   * EXPLICIT tenant identified by `tenantId`. Exactly two independent grant
   * paths are evaluated — either is sufficient:
   *
   *   1. Tenant-scoped grant (Club Admin / delegated-user path) — identical
   *      to `hasPermission({ tenantId })`: an active `TenantMembership` in
   *      this exact tenant plus a `TENANT` role (owned by this tenant)
   *      carrying the permission. Tenant isolation and role-ownership rules
   *      are completely unchanged.
   *
   *   2. Platform SCE Super Admin cross-tenant authority — the caller holds
   *      the SAME permission key at PLATFORM scope (no `TenantMembership`
   *      or tenant role required), resolved against a tenant that is
   *      confirmed to exist and be operationally ACTIVE. This is the
   *      correction: an SCE Super Admin's platform-held deletion permission
   *      is no longer required to be duplicated as a tenant-scoped grant
   *      before it can be exercised in another tenant.
   *
   * `tenantId` is a REQUIRED, explicit parameter — there is no
   * platform-only ("no tenant context") mode for this method, because
   * deletion is always an operation against one specific tenant's data.
   * Every grant path above still requires resolving that tenant's real,
   * live `status` from the database on every call (never cached) — an
   * unresolved, archived, or otherwise-invalid tenant id is denied even
   * when the caller holds the platform-scoped permission.
   *
   * Caller obligation (never enforced by this method, and NOT satisfied by
   * simply calling it): `tenantId` MUST be derived from a server-side
   * lookup of the entity actually being deleted (e.g. the `tenantId` column
   * on the `Team` row resolved by its own id), never taken directly from a
   * client-supplied request field. Passing an unvalidated client tenantId
   * straight through — even though this method independently checks that
   * the tenant is real and ACTIVE — reintroduces exactly the "blindly trust
   * the client" failure mode the policy forbids, because a malicious caller
   * could simply supply any other real, active tenant's id. Confirming the
   * tenant is real is a floor, not a substitute for resolving it from the
   * target entity server-side.
   *
   * Restricted by convention to "<module>.delete" keys — enforced at
   * runtime by throwing for any other key. This is deliberately NOT a
   * general "platform role implies tenant access" bypass (that would
   * reopen the exact gap RPERM-04 closed for every ordinary permission);
   * only permanent-deletion permissions carry cross-tenant SCE authority.
   * "manage"/"view" permissions continue to require real tenant membership
   * via `hasPermission`, exactly as before.
   */
  async hasTenantDeletionAuthority(params: HasPermissionParams & { tenantId: string }): Promise<boolean> {
    const { userId, permission, tenantId } = params;

    if (!userId || !permission || !tenantId) return false;

    if (!permission.endsWith(".delete")) {
      throw new Error(
        `hasTenantDeletionAuthority() is reserved for "<module>.delete"-convention permissions; ` +
          `received "${permission}". Use hasPermission() for non-deletion permission checks.`,
      );
    }

    // Path 1: existing tenant-scoped grant — Club Admin / delegated user.
    const tenantKeys = await resolveTenantPermissions(this.prisma, userId, tenantId);
    if (tenantKeys.has(permission)) return true;

    // Path 2: platform SCE Super Admin cross-tenant authority. Only ever
    // considered once a genuine, operationally ACTIVE tenant has been
    // confirmed to exist for the supplied tenantId — an unresolved or
    // forged tenant id is denied regardless of platform grants.
    const platformKeys = await resolvePlatformPermissions(this.prisma, userId);
    if (!platformKeys.has(permission)) return false;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });

    return tenant?.status === "ACTIVE";
  }

  /**
   * Returns the structured set of effective permission keys for the user.
   *
   * When `tenantId` is omitted, only platform permissions are resolved.
   * When `tenantId` is provided, both platform and tenant permissions are
   * resolved and returned separately.
   *
   * Internal deduplication uses `Set`. The returned arrays are deduplicated
   * and sorted for stable output; do not rely on insertion order.
   */
  async getEffectivePermissions(
    params: GetEffectivePermissionsParams,
  ): Promise<EffectivePermissionsResult> {
    const { userId, tenantId } = params;

    if (!userId) {
      return { platform: [], tenant: [] };
    }

    const platformKeys = await resolvePlatformPermissions(this.prisma, userId);

    if (!tenantId) {
      return {
        platform: [...platformKeys].sort(),
        tenant: [],
      };
    }

    const tenantKeys = await resolveTenantPermissions(this.prisma, userId, tenantId);

    return {
      platform: [...platformKeys].sort(),
      tenant: [...tenantKeys].sort(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory for production use
// ---------------------------------------------------------------------------

/**
 * Creates a resolver bound to the provided PrismaClient.
 *
 * In application code (server actions, API routes) prefer this factory over
 * constructing EffectivePermissionResolver directly.
 *
 * @example
 * ```ts
 * import { prisma } from "@/lib/db/prisma";
 * import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
 *
 * const resolver = createEffectivePermissionResolver(prisma);
 * const allowed = await resolver.hasPermission({
 *   userId: session.user.id,
 *   permission: "trainings.view",
 *   tenantId: session.user.activeTenantId,
 * });
 * ```
 */
export function createEffectivePermissionResolver(
  prisma: PrismaClient,
): EffectivePermissionResolver {
  return new EffectivePermissionResolver(prisma);
}
