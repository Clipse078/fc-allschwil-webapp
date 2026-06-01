import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Hash,
  KeyRound,
  Mail,
  Pencil,
  Shield,
  UserCog,
} from "lucide-react";
import UserForm from "@/components/admin/users/UserForm";
import UserRolesForm from "@/components/admin/users/UserRolesForm";
import ResetPasswordForm from "@/components/admin/users/ResetPasswordForm";
import DeleteUserButton from "@/components/admin/users/DeleteUserButton";
import ImpersonateButton from "@/components/admin/users/ImpersonateButton";
import { requirePermission } from "@/lib/permissions/require-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData, getUserDetailData } from "@/lib/users/queries";

type UserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getRoleHeroBadgeClass(roleName: string): string {
  const n = roleName.toLowerCase();
  if (n.includes("superadmin"))
    return "inline-flex h-5 items-center rounded-full border border-red-300/60 bg-red-500/20 px-2.5 text-[0.65rem] font-semibold text-red-200";
  if (n.includes("admin"))
    return "inline-flex h-5 items-center rounded-full border border-orange-300/60 bg-orange-500/20 px-2.5 text-[0.65rem] font-semibold text-orange-200";
  if (n.includes("trainer"))
    return "inline-flex h-5 items-center rounded-full border border-emerald-300/60 bg-emerald-500/20 px-2.5 text-[0.65rem] font-semibold text-emerald-200";
  return "inline-flex h-5 items-center rounded-full border border-white/20 bg-white/10 px-2.5 text-[0.65rem] font-semibold text-white/70";
}

export default async function UserDetailPage({
  params,
}: UserDetailPageProps) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const canImpersonate = hasPermission(session, PERMISSIONS.USERS_IMPERSONATE);

  const { userId } = await params;
  const user = await getUserDetailData(userId);

  if (!user) {
    notFound();
  }

  const roles = await getRolesListData();
  const initialRoleIds = user.userRoles.map((userRole) => userRole.role.id);
  const initials = getInitials(user.firstName, user.lastName);
  const displayName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Identity */}
          <div className="flex items-center gap-5">
            <div className="sce-avatar-xl">{initials}</div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Benutzerkonto
              </p>
              <h1
                className="mt-1 text-2xl font-bold text-white"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.01em",
                }}
              >
                {displayName}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {/* Status badge */}
                <span
                  className={`inline-flex h-5 items-center rounded-full border px-2.5 text-[0.65rem] font-semibold ${
                    user.isActive
                      ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-200"
                      : "border-white/20 bg-white/10 text-white/60"
                  }`}
                >
                  {user.isActive ? "Aktiv" : "Inaktiv"}
                </span>
                {/* Role badges */}
                {user.userRoles.map(({ role }) => (
                  <span key={role.id} className={getRoleHeroBadgeClass(role.name)}>
                    {role.name}
                  </span>
                ))}
                {user.userRoles.length === 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full border border-white/15 bg-white/08 px-2.5 text-[0.65rem] font-semibold text-white/40">
                    Keine Rolle
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {canImpersonate ? (
              <ImpersonateButton userId={user.id} variant="hero" />
            ) : null}
            <Link
              href="/dashboard/users"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück
            </Link>
          </div>
        </div>

        {/* Quick-info strip */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-6 border-t border-white/15 pt-4">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <Mail className="h-4 w-4 text-white/60" />
            <span>{user.email}</span>
          </div>
          {user.lastLoginAt ? (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Calendar className="h-4 w-4 text-white/60" />
              <span>
                Letzter Login:{" "}
                <span className="font-semibold text-white">
                  {formatDate(user.lastLoginAt)}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Calendar className="h-4 w-4 text-white/40" />
              <span>Noch nie eingeloggt</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Account Information */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Kontoinformationen
                </p>
              </div>
              <DeleteUserButton userId={user.id} isActive={user.isActive} />
            </div>
            <div className="sce-detail-section-body">
              <UserForm
                mode="edit"
                userId={user.id}
                initialValues={{
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  isActive: user.isActive,
                }}
              />
            </div>
          </div>

          {/* Roles & Access */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Rollen & Zugriff
                </p>
                {user.userRoles.length > 0 ? (
                  <span className="sce-count-badge">
                    {user.userRoles.length}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="sce-detail-section-body">
              <UserRolesForm
                userId={user.id}
                initialRoles={roles}
                initialSelectedRoleIds={initialRoleIds}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Assigned Person */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Verknüpfte Person
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <p className="text-sm italic text-[var(--muted)]">
                Keine Person verknüpft.
              </p>
            </div>
          </div>

          {/* Reset Password */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Passwort zurücksetzen
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <ResetPasswordForm userId={user.id} />
            </div>
          </div>

          {/* System Information */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Systemdaten
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Erstellt</span>
                <span className="sce-data-value">{formatDate(user.createdAt)}</span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="sce-data-value">{formatDate(user.updatedAt)}</span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">ID</span>
                <code className="font-mono text-[0.72rem] text-[var(--muted)]">
                  {user.id}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
