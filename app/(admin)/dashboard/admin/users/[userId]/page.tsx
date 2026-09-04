import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Shield,
  UserCircle2,
  UserRound,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUserDetail } from "@/lib/users/queries";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import { getScopedAssignmentsForUser } from "@/lib/roles/scoped-mutations";
import { getOrgUnitsForTenant } from "@/lib/people/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import MembershipAccessControl from "@/components/admin/users/MembershipAccessControl";
import TenantRoleAssignmentControl from "@/components/admin/users/TenantRoleAssignmentControl";
import ScopedRoleManagementControl from "@/components/admin/users/ScopedRoleManagementControl";
import InvitePersonControl from "@/components/admin/users/InvitePersonControl";
import PersonEffectiveAccessCard from "@/components/admin/users/PersonEffectiveAccessCard";

type Props = {
  params: Promise<{ userId: string }>;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const { userId } = await params;

  const [membership, allTenantRoles, scopedAssignments, orgUnits] = await Promise.all([
    getTenantUserDetail(tenantId, userId),
    getTenantRolesOverview(tenantId),
    getScopedAssignmentsForUser(tenantId, userId),
    getOrgUnitsForTenant(tenantId),
  ]);
  if (!membership) notFound();

  const availableRoles = allTenantRoles
    .filter((r) => !r.isArchived)
    .map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }));

  // Available roles for scoped assignments (exclude Club Admin — enforced server-side too)
  const availableScopedRoles = allTenantRoles
    .filter((r) => !r.isArchived)
    .map((r) => ({ id: r.id, name: r.name }));

  const availableOrgUnits = orgUnits.map((u) => ({ id: u.id, name: u.name }));

  const user = membership.user;
  const displayName = `${user.firstName} ${user.lastName}`;

  // Club Admins hold USERS_MANAGE_MEMBERSHIPS (TENANT); platform Super Admins hold USERS_MANAGE.
  const canManage =
    hasPermission(session, PERMISSIONS.USERS_MANAGE_MEMBERSHIPS) ||
    hasPermission(session, PERMISSIONS.USERS_MANAGE);
  const canInvite = hasPermission(session, PERMISSIONS.USERS_INVITE);
  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const isSelf = currentUserId === userId;

  const isEffectivelyActive = membership.isActive && user.isActive;

  // Person linkage
  const linkedPerson = user.person;
  const hasLinkedPerson = linkedPerson !== null;

  // Pending invitation is determined solely by the presence of an active
  // (non-expired, non-used) invitation token — NOT by lastLoginAt.
  // A user with an existing global account (lastLoginAt set from another tenant)
  // may have a pending invitation for this tenant (multi-tenant use case).
  const pendingInvitation = user.passwordResetTokens.length > 0;

  // Scoped assignments mapped for the management control
  const scopedItems = scopedAssignments.map((a) => ({
    id: a.id,
    roleId: a.roleId,
    roleName: a.roleName,
    roleKey: a.roleKey,
    orgUnitId: a.orgUnitId,
    orgUnitName: a.orgUnitName,
    scopeMode: a.scopeMode,
  }));

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Personen & Zugänge"
        title={displayName}
        actions={
          <Link
            href="/dashboard/admin/people-access"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Übersicht
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Identity card */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Identität
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <div className="flex items-start gap-4">
                <AdminAvatar name={displayName} size="lg" />
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[var(--foreground)]">
                        {displayName}
                      </p>
                      {isSelf ? (
                        <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[0.65rem] font-semibold text-amber-700">
                          Ich
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
                      <span>{user.email}</span>
                    </div>
                    {user.lastLoginAt ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)]" />
                        <span>
                          Letzter Login:{" "}
                          <span className="font-medium text-[var(--foreground)]">
                            {formatDate(user.lastLoginAt)}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Noch nie eingeloggt</span>
                      </div>
                    )}
                  </div>

                  {/* Access status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">Status:</span>
                    {pendingInvitation ? (
                      <AdminStatusPill label="Einladung ausstehend" tone="warning" />
                    ) : isEffectivelyActive ? (
                      <AdminStatusPill label="Aktiv" tone="success" />
                    ) : (
                      <AdminStatusPill label="Deaktiviert" tone="muted" />
                    )}
                  </div>

                  {/* Person linkage */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">Person:</span>
                    {hasLinkedPerson ? (
                      <Link
                        href={`/dashboard/persons/${linkedPerson!.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <UserRound className="h-3 w-3" />
                        {linkedPerson!.firstName} {linkedPerson!.lastName}
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Keine Person verknüpft</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Zugriff — consolidated view */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Zugriff
                </p>
                <span className="sce-count-badge">
                  {user.userRoles.length + scopedAssignments.length}
                </span>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-5">
              {/* Sub-section: Clubweit (tenant-wide roles — manageable) */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Clubweit
                </p>
                <TenantRoleAssignmentControl
                  userId={userId}
                  availableRoles={availableRoles}
                  initialRoleIds={user.userRoles.map((ur) => ur.role.id)}
                  canManage={canManage}
                />
              </div>

              {/* Sub-section: Bereiche (scoped — manageable) */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Bereiche
                </p>
                <ScopedRoleManagementControl
                  userId={userId}
                  assignments={scopedItems}
                  availableRoles={availableScopedRoles}
                  availableOrgUnits={availableOrgUnits}
                  canManage={canManage}
                />
              </div>
            </div>
          </div>

          <PersonEffectiveAccessCard tenantId={tenantId} userId={userId} />
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Club access management */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Club-Zugriff
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <MembershipAccessControl
                userId={userId}
                userName={displayName}
                userEmail={user.email}
                membershipIsActive={membership.isActive}
                userIsActive={user.isActive}
                canManage={canManage}
                isSelf={isSelf}
                linkedPersonName={linkedPerson ? `${linkedPerson.firstName} ${linkedPerson.lastName}` : null}
                tenantRoleNames={user.userRoles.map((ur) => ur.role.name)}
              />
            </div>
          </div>

          {/* Invitation management */}
          {(pendingInvitation || (canInvite && !user.lastLoginAt)) ? (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--muted)]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Einladung
                  </p>
                </div>
              </div>
              <div className="sce-detail-section-body">
                <InvitePersonControl
                  userId={userId}
                  canManage={canInvite}
                  pendingInvitation={pendingInvitation}
                />
              </div>
            </div>
          ) : null}

          {/* Membership metadata */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Mitgliedschaft
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-3">
              <div className="sce-data-field">
                <span className="sce-data-label">Beigetreten</span>
                <span className="sce-data-value">
                  {formatDate(membership.joinedAt)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Gesamtstatus</span>
                <span className="sce-data-value">
                  {pendingInvitation
                    ? "Einladung ausstehend"
                    : isEffectivelyActive
                    ? "Vollständig aktiv"
                    : "Eingeschränkt"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
