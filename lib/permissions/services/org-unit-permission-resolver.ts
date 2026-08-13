/**
 * ORG-ACCESS-01 — OrgUnit-Scoped Permission Resolver
 *
 * Adds `hasPermissionInOrgUnit` as a focused resolver for authorizing whether
 * a user holds a permission within a specific OrgUnit in a tenant.
 *
 * ── Responsibility ────────────────────────────────────────────────────────────
 * Extends the existing RPERM authorization model with OrgUnit-scoped checks.
 * Does NOT replace `hasPermission()` for tenant-wide checks.
 *
 * ── Semantics ─────────────────────────────────────────────────────────────────
 *  1. Tenant-wide assignment (orgUnitId IS NULL) granting permission:
 *       → YES for any OrgUnit in the same tenant.
 *  2. THIS_ORG_UNIT assignment on unit X:
 *       → YES only for exact OrgUnit X, NO for any child/parent/sibling.
 *  3. THIS_ORG_UNIT_AND_DESCENDANTS assignment on unit X:
 *       → YES for OrgUnit X and every descendant (child, grandchild, …).
 *       → NO for parent/sibling of X.
 *  4. Multiple assignments combine: any matching assignment → YES.
 *  5. Inactive/archived role behavior follows existing RPERM rules (archived
 *     roles are excluded; inactive TenantMembership blocks all access).
 *  6. Inactive tenant (ARCHIVED / INACTIVE) blocks access, same as tenant-wide checks.
 *  7. PLATFORM roles never satisfy OrgUnit-scoped tenant checks.
 *
 * ── Fail-Closed ───────────────────────────────────────────────────────────────
 * Returns `false` for any missing, inactive, or incompatible authorization path.
 * Infrastructure failures propagate as exceptions.
 *
 * ── Ancestor-walk strategy ────────────────────────────────────────────────────
 * The OrgUnit hierarchy has a max depth of 3 levels (enforced by org-unit API).
 * For THIS_ORG_UNIT_AND_DESCENDANTS checks, the target's ancestor chain is
 * loaded in a single eager query (parent → parent.parent → parent.parent.parent)
 * rather than a recursive DB query. This is O(1) in DB round-trips regardless
 * of tenant size.
 *
 * ── Out of Scope ──────────────────────────────────────────────────────────────
 * Resource-specific enforcement (Training, Match, Tournament) is deferred to
 * ORG-ACCESS-02+. This resolver is the pure authorization primitive only.
 */

import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HasPermissionInOrgUnitParams {
  /** ID of the user to check. */
  userId: string;
  /** Permission key to check (must be TENANT-scoped). */
  permission: string;
  /** Tenant in which the check is performed. */
  tenantId: string;
  /** OrgUnit to check authorization for. */
  orgUnitId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Loads the ordered ancestor chain for `targetOrgUnitId`, including the
 * target itself, as a Set of OrgUnit IDs.
 *
 * Returns { target, ancestorIds } where `ancestorIds` contains the target id
 * and all its ancestors (up to the root). Uses a single Prisma query with
 * eager nested parent navigation (max 3 levels deep per the org hierarchy
 * depth constraint).
 */
async function loadAncestorChain(
  prisma: PrismaClient,
  targetOrgUnitId: string,
): Promise<{ found: boolean; tenantId: string | null; ancestorIds: Set<string> }> {
  const unit = await prisma.orgUnit.findUnique({
    where: { id: targetOrgUnitId },
    select: {
      id: true,
      tenantId: true,
      parentId: true,
      parent: {
        select: {
          id: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              parentId: true,
            },
          },
        },
      },
    },
  });

  if (!unit) {
    return { found: false, tenantId: null, ancestorIds: new Set() };
  }

  const ids = new Set<string>();
  ids.add(unit.id);
  if (unit.parent) {
    ids.add(unit.parent.id);
    if (unit.parent.parent) {
      ids.add(unit.parent.parent.id);
    }
  }

  return { found: true, tenantId: unit.tenantId, ancestorIds: ids };
}

// ---------------------------------------------------------------------------
// Resolver class
// ---------------------------------------------------------------------------

/**
 * Resolves OrgUnit-scoped permissions for a user within a tenant.
 *
 * Construct with a `PrismaClient` instance (same pattern as
 * `EffectivePermissionResolver`). Use `createOrgUnitPermissionResolver` for
 * production.
 */
export class OrgUnitPermissionResolver {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns `true` if and only if the user holds `permission` within
   * `orgUnitId` in `tenantId`.
   *
   * See module header for full semantics. Fails closed.
   */
  async hasPermissionInOrgUnit(params: HasPermissionInOrgUnitParams): Promise<boolean> {
    const { userId, permission, tenantId, orgUnitId } = params;

    if (!userId || !permission || !tenantId || !orgUnitId) return false;

    // Gate 1: active TenantMembership + operationally ACTIVE tenant.
    // Same gate as existing resolveTenantPermissions — fail-closed.
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { isActive: true, tenant: { select: { status: true } } },
    });
    if (!membership?.isActive || membership.tenant.status !== "ACTIVE") {
      return false;
    }

    // Gate 2: load ALL tenant-scoped UserRoles for this user that carry the
    // requested permission (both tenant-wide and OrgUnit-scoped).
    // role.tenantId = tenantId enforces role ownership (RPERM-04 invariant).
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        role: {
          scope: "TENANT",
          tenantId,
          isArchived: false,
          rolePermissions: {
            some: {
              permission: { key: permission, scope: "TENANT" },
            },
          },
        },
      },
      select: {
        orgUnitId: true,
        scopeMode: true,
      },
    });

    if (userRoles.length === 0) return false;

    // Fast path: a genuine tenant-wide assignment (orgUnitId IS NULL AND scopeMode IS NULL)
    // grants access for all OrgUnits in the tenant.
    // Defense-in-depth: a malformed row where orgUnitId=null but scopeMode is set
    // (e.g. left behind by a SET NULL cascade) MUST NOT be treated as tenant-wide.
    // With the Cascade FK this state cannot arise from normal OrgUnit deletion, but
    // we guard here regardless so no persisted anomaly can ever escalate privileges.
    if (userRoles.some((ur) => ur.orgUnitId === null && ur.scopeMode === null)) {
      return true;
    }

    // Collect the OrgUnit IDs referenced by scoped assignments.
    const relevantOrgUnitIds = new Set(userRoles.map((ur) => ur.orgUnitId).filter(Boolean));

    // Exact-match fast path: if any assignment is THIS_ORG_UNIT and targets
    // exactly orgUnitId → granted immediately without ancestor lookup.
    const hasExactMatch = userRoles.some(
      (ur) => ur.orgUnitId === orgUnitId && ur.scopeMode === "THIS_ORG_UNIT",
    );
    if (hasExactMatch) return true;

    // Check whether any THIS_ORG_UNIT_AND_DESCENDANTS assignment covers the target.
    // An assignment on ancestor X covers orgUnitId iff X is in the ancestor chain
    // of orgUnitId (i.e. X is orgUnitId itself, or a parent/grandparent).
    const descendantAssignments = userRoles.filter(
      (ur) => ur.orgUnitId !== null && ur.scopeMode === "THIS_ORG_UNIT_AND_DESCENDANTS",
    );

    if (descendantAssignments.length === 0) return false;

    // Load the ancestor chain of the target OrgUnit once.
    const { found, tenantId: unitTenantId, ancestorIds } = await loadAncestorChain(
      this.prisma,
      orgUnitId,
    );

    if (!found) return false;

    // Cross-tenant safety: OrgUnit must belong to the same tenant.
    if (unitTenantId !== tenantId) return false;

    // If any assigned OrgUnit is in the ancestor chain of the target,
    // then the assignment covers the target.
    for (const ur of descendantAssignments) {
      if (ur.orgUnitId && ancestorIds.has(ur.orgUnitId)) {
        return true;
      }
    }

    return false;
  }
}

// ---------------------------------------------------------------------------
// Factory for production use
// ---------------------------------------------------------------------------

/**
 * Creates an `OrgUnitPermissionResolver` bound to the provided PrismaClient.
 *
 * @example
 * ```ts
 * import { prisma } from "@/lib/db/prisma";
 * import { createOrgUnitPermissionResolver } from "@/lib/permissions/services/org-unit-permission-resolver";
 *
 * const resolver = createOrgUnitPermissionResolver(prisma);
 * const allowed = await resolver.hasPermissionInOrgUnit({
 *   userId: session.user.id,
 *   permission: "trainings.manage",
 *   tenantId: session.user.activeTenantId,
 *   orgUnitId: teamOrgUnitId,
 * });
 * ```
 */
export function createOrgUnitPermissionResolver(prisma: PrismaClient): OrgUnitPermissionResolver {
  return new OrgUnitPermissionResolver(prisma);
}
