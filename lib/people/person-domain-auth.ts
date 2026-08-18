/**
 * PERSON-UX-03 — Person-domain authorization helper.
 *
 * Canonical server-side helper that resolves which sensitive Person-domain
 * permissions a viewer holds within a tenant. Returned flags are passed from
 * server loaders to the PersonDetailTabs client component.
 *
 * ── Design principles ──────────────────────────────────────────────────────
 * • Fail-closed: every path returns false for any missing or invalid state.
 * • No role-name checks: authorization is purely permission-key driven.
 * • No new framework: delegates entirely to the existing
 *   EffectivePermissionResolver (RPERM-03) and OrgUnitPermissionResolver
 *   (ORG-ACCESS-01). resolvePersonDomainPermissions uses a single
 *   getEffectivePermissions call for efficiency.
 * • Sensitive domains are NOT implied by people.view or people.manage.
 *
 * ── Scope behavior ─────────────────────────────────────────────────────────
 * resolvePersonDomainPermissions:
 *   Tenant-wide check. A viewer with a tenant-wide RolePermission grant
 *   passes for any Person in the tenant.
 *
 * resolvePersonDomainPermissionsForOrgUnit:
 *   OrgUnit-scoped check. Reuses ORG-ACCESS-01 semantics:
 *   - Tenant-wide grant → passes for any OrgUnit in the tenant.
 *   - THIS_ORG_UNIT grant on X → passes only for exact OrgUnit X.
 *   - THIS_ORG_UNIT_AND_DESCENDANTS on X → passes for X and all descendants.
 *   - No grant crosses OrgUnit or tenant boundaries.
 *
 * ── Authorization boundary for AUDIT-01 ────────────────────────────────────
 * This mapping is the canonical boundary reused by AUDIT-01 event filtering.
 * An audit entry for domain D must only be surfaced to a viewer who passes
 * the corresponding canView<D> flag.
 *
 * Domain → permission key:
 *   Finance           → people.finance.view / .manage
 *   Health / medical  → people.health.view  / .manage
 *   Private documents → people.private_documents.view / .manage
 *   Development       → people.development.view / .manage
 *   Assessments       → people.assessments.view / .manage
 *   Audit history     → people.audit.view
 */

import type { PrismaClient } from "@prisma/client";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { createOrgUnitPermissionResolver } from "@/lib/permissions/services/org-unit-permission-resolver";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

/**
 * Sensitive Person-domain access flags resolved for a specific viewer.
 *
 * All fields default to false (fail-closed). Passed from server loaders to
 * the PersonDetailTabs client component so that tab-visibility decisions are
 * made without additional DB calls on the client.
 */
export type PersonDomainPermissions = {
  /** people.finance.view */
  canViewFinance: boolean;
  /** people.finance.manage */
  canManageFinance: boolean;
  /** people.health.view */
  canViewHealth: boolean;
  /** people.health.manage */
  canManageHealth: boolean;
  /** people.private_documents.view */
  canViewPrivateDocuments: boolean;
  /** people.private_documents.manage */
  canManagePrivateDocuments: boolean;
  /** people.development.view */
  canViewDevelopment: boolean;
  /** people.development.manage */
  canManageDevelopment: boolean;
  /** people.audit.view */
  canViewAudit: boolean;
};

// ---------------------------------------------------------------------------
// Fail-closed default
// ---------------------------------------------------------------------------

/**
 * Safe fallback used when no tenantId is available or authorization fails.
 * All sensitive domains denied.
 */
export const DOMAIN_PERMISSIONS_DENIED: PersonDomainPermissions = {
  canViewFinance: false,
  canManageFinance: false,
  canViewHealth: false,
  canManageHealth: false,
  canViewPrivateDocuments: false,
  canManagePrivateDocuments: false,
  canViewDevelopment: false,
  canManageDevelopment: false,
  canViewAudit: false,
};

// ---------------------------------------------------------------------------
// Tenant-wide resolver
// ---------------------------------------------------------------------------

/**
 * Resolves tenant-wide sensitive Person-domain permissions for a viewer.
 *
 * Uses the canonical EffectivePermissionResolver (RPERM-03) via a single
 * getEffectivePermissions call. All checks are live (no session cache) and
 * fail-closed.
 *
 * @param prisma   - PrismaClient instance
 * @param userId   - ID of the viewer
 * @param tenantId - Tenant in which to resolve permissions
 */
export async function resolvePersonDomainPermissions(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
): Promise<PersonDomainPermissions> {
  const resolver = createEffectivePermissionResolver(prisma);
  const { tenant } = await resolver.getEffectivePermissions({ userId, tenantId });
  const has = (key: string): boolean => tenant.includes(key);

  return {
    canViewFinance:            has(PERMISSIONS.PEOPLE_FINANCE_VIEW),
    canManageFinance:          has(PERMISSIONS.PEOPLE_FINANCE_MANAGE),
    canViewHealth:             has(PERMISSIONS.PEOPLE_HEALTH_VIEW),
    canManageHealth:           has(PERMISSIONS.PEOPLE_HEALTH_MANAGE),
    canViewPrivateDocuments:   has(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_VIEW),
    canManagePrivateDocuments: has(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE),
    canViewDevelopment:        has(PERMISSIONS.PEOPLE_DEVELOPMENT_VIEW),
    canManageDevelopment:      has(PERMISSIONS.PEOPLE_DEVELOPMENT_MANAGE),
    canViewAudit:              has(PERMISSIONS.PEOPLE_AUDIT_VIEW),
  };
}

// ---------------------------------------------------------------------------
// OrgUnit-scoped resolver
// ---------------------------------------------------------------------------

/**
 * Resolves OrgUnit-scoped sensitive Person-domain permissions for a viewer.
 *
 * Checks whether the viewer holds each sensitive permission within the
 * specified OrgUnit. Applies ORG-ACCESS-01 semantics:
 * - Tenant-wide grants satisfy any OrgUnit in the tenant.
 * - Scoped grants are evaluated with ancestor-walk logic.
 * - Cross-OrgUnit and cross-tenant access is denied.
 *
 * Use this when the Person belongs to a known primary OrgUnit and you want
 * to enforce that a scoped coordinator cannot see data for Persons outside
 * their authorized OrgUnit(s).
 *
 * Current gap: Person records do not carry a canonical `primaryOrgUnitId`.
 * Until that field exists, callers must select the relevant OrgUnit themselves
 * (e.g. from active PersonAssignment records). If no OrgUnit can be resolved,
 * use resolvePersonDomainPermissions (tenant-wide) and document the gap.
 *
 * @param prisma     - PrismaClient instance
 * @param userId     - ID of the viewer
 * @param tenantId   - Tenant in which to resolve permissions
 * @param orgUnitId  - OrgUnit the target Person belongs to
 */
export async function resolvePersonDomainPermissionsForOrgUnit(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
  orgUnitId: string,
): Promise<PersonDomainPermissions> {
  const resolver = createOrgUnitPermissionResolver(prisma);
  const check = (permission: string): Promise<boolean> =>
    resolver.hasPermissionInOrgUnit({ userId, permission, tenantId, orgUnitId });

  const [
    canViewFinance,
    canManageFinance,
    canViewHealth,
    canManageHealth,
    canViewPrivateDocuments,
    canManagePrivateDocuments,
    canViewDevelopment,
    canManageDevelopment,
    canViewAudit,
  ] = await Promise.all([
    check(PERMISSIONS.PEOPLE_FINANCE_VIEW),
    check(PERMISSIONS.PEOPLE_FINANCE_MANAGE),
    check(PERMISSIONS.PEOPLE_HEALTH_VIEW),
    check(PERMISSIONS.PEOPLE_HEALTH_MANAGE),
    check(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_VIEW),
    check(PERMISSIONS.PEOPLE_PRIVATE_DOCUMENTS_MANAGE),
    check(PERMISSIONS.PEOPLE_DEVELOPMENT_VIEW),
    check(PERMISSIONS.PEOPLE_DEVELOPMENT_MANAGE),
    check(PERMISSIONS.PEOPLE_AUDIT_VIEW),
  ]);

  return {
    canViewFinance,
    canManageFinance,
    canViewHealth,
    canManageHealth,
    canViewPrivateDocuments,
    canManagePrivateDocuments,
    canViewDevelopment,
    canManageDevelopment,
    canViewAudit,
  };
}
