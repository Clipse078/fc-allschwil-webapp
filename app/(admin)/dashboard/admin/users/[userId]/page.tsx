import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Shield,
  UserCircle2,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUserDetail } from "@/lib/users/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import MembershipAccessControl from "@/components/admin/users/MembershipAccessControl";

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

function getRoleBadgeClass(roleKey: string): string {
  const k = roleKey.toLowerCase();
  if (k.includes("superadmin") || k.includes("super_admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("trainer")) return "sce-role-badge sce-role-badge-trainer";
  if (k.includes("staff")) return "sce-role-badge sce-role-badge-staff";
  return "sce-role-badge sce-role-badge-member";
}

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const { userId } = await params;

  const membership = await getTenantUserDetail(tenantId, userId);
  if (!membership) notFound();

  const user = membership.user;
  const displayName = `${user.firstName} ${user.lastName}`;

  const canManage = hasPermission(session, PERMISSIONS.USERS_MANAGE);
  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const isSelf = currentUserId === userId;

  const isEffectivelyActive = membership.isActive && user.isActive;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration · Benutzer"
        title={displayName}
        actions={
          <Link
            href="/dashboard/admin/users"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Benutzer
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
                  Benutzerkonto
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

                  {/* Account status — read-only */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">Konto:</span>
                    {user.isActive ? (
                      <AdminStatusPill label="Aktiv" tone="success" />
                    ) : (
                      <AdminStatusPill label="Inaktiv" tone="muted" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant roles — read-only */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Club-Rollen
                </p>
                {user.userRoles.length > 0 ? (
                  <span className="sce-count-badge">{user.userRoles.length}</span>
                ) : null}
              </div>
            </div>
            <div className="sce-detail-section-body">
              {user.userRoles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {user.userRoles.map(({ role }) => (
                    <span key={role.id} className={getRoleBadgeClass(role.key)}>
                      {role.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Keine Club-Rollen zugewiesen.
                </p>
              )}
            </div>
          </div>
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
                membershipIsActive={membership.isActive}
                userIsActive={user.isActive}
                canManage={canManage}
                isSelf={isSelf}
              />
            </div>
          </div>

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
                  {isEffectivelyActive ? "Vollständig aktiv" : "Eingeschränkt"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
