"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, UserPlus, Users, UserX } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { EmptyState } from "@/components/ui/page/EmptyState";
import UserRowActionsMenu from "@/components/admin/users/UserRowActionsMenu";
import type { TenantUserItem, TenantPersonWithoutUser } from "@/lib/users/queries";

type Props = {
  initialUsers: TenantUserItem[];
  personsWithoutUser: TenantPersonWithoutUser[];
  currentUserId: string;
  canInvite: boolean;
  /** Club Admin or platform Super Admin may manage memberships for this tenant. */
  canManage?: boolean;
  /** Platform-only: may permanently delete global user accounts. */
  canGlobalDelete?: boolean;
};

function getRoleBadgeClass(roleKey: string): string {
  const k = roleKey.toLowerCase();
  if (k.includes("superadmin") || k.includes("super_admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("trainer")) return "sce-role-badge sce-role-badge-trainer";
  if (k.includes("staff")) return "sce-role-badge sce-role-badge-staff";
  return "sce-role-badge sce-role-badge-member";
}

type StatusFilter = "all" | "active" | "deactivated" | "pending" | "not_invited";

function getAccessStatusLabel(
  user: TenantUserItem,
): { label: string; tone: "success" | "warning" | "muted" } {
  const isEffectivelyActive = user.membershipIsActive && user.userIsActive;
  if (user.pendingInvitation) {
    return { label: "Einladung ausstehend", tone: "warning" };
  }
  if (isEffectivelyActive) {
    return { label: "Aktiv", tone: "success" };
  }
  return { label: "Deaktiviert", tone: "muted" };
}

function formatLastLogin(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TenantUsersSearchableList({
  initialUsers,
  personsWithoutUser,
  currentUserId,
  canInvite,
  canManage = false,
  canGlobalDelete = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const uniqueRoles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of initialUsers) {
      for (const r of u.roles) {
        if (!seen.has(r.id)) seen.set(r.id, r.name);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [initialUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialUsers.filter((u) => {
      const isEffectivelyActive = u.membershipIsActive && u.userIsActive;
      if (statusFilter === "active" && !isEffectivelyActive) return false;
      if (statusFilter === "deactivated" && (isEffectivelyActive || u.pendingInvitation)) return false;
      if (statusFilter === "pending" && !u.pendingInvitation) return false;
      if (statusFilter === "not_invited") return false;
      if (roleFilter !== "all" && !u.roles.some((r) => r.id === roleFilter)) return false;
      if (q) {
        const matches =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.roles.some((r) => r.name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [initialUsers, query, statusFilter, roleFilter]);

  const filteredPersons = useMemo(() => {
    if (statusFilter !== "all" && statusFilter !== "not_invited") return [];
    const q = query.trim().toLowerCase();
    return personsWithoutUser.filter((p) => {
      if (q) {
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [personsWithoutUser, query, statusFilter]);

  const activeCount = initialUsers.filter((u) => u.membershipIsActive && u.userIsActive).length;
  const pendingCount = initialUsers.filter((u) => u.pendingInvitation).length;
  const inactiveCount = initialUsers.filter(
    (u) => !(u.membershipIsActive && u.userIsActive) && !u.pendingInvitation,
  ).length;
  const noAccountCount = personsWithoutUser.length;

  const isFiltered = query.trim() !== "" || statusFilter !== "all" || roleFilter !== "all";
  const totalShown = filteredUsers.length + filteredPersons.length;
  const grandTotal = initialUsers.length + personsWithoutUser.length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktiv</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Zugänge</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Einladung</p>
          <p
            className="mt-1.5 text-2xl font-bold text-amber-500"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">ausstehend</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Deaktiviert</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--muted)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {inactiveCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">ohne Zugriff</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Nicht eingeladen</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {noAccountCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Personen</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="sce-page-search flex-1 min-w-[200px]">
          <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Name oder E-Mail suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex-shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Löschen
            </button>
          ) : null}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30"
          aria-label="Status filtern"
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktiv ({activeCount})</option>
          <option value="pending">Einladung ausstehend ({pendingCount})</option>
          <option value="deactivated">Deaktiviert ({inactiveCount})</option>
          <option value="not_invited">Nicht eingeladen ({noAccountCount})</option>
        </select>

        {/* Role filter */}
        {uniqueRoles.length > 0 ? (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30"
            aria-label="Rolle filtern"
          >
            <option value="all">Alle Rollen</option>
            {uniqueRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : null}

        {/* Invite new person */}
        {canInvite ? (
          <Link
            href="/dashboard/admin/people-access/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--blue,#2563EB)] px-3 text-sm font-medium text-white hover:opacity-90 transition"
          >
            <UserPlus className="h-4 w-4" />
            Person hinzufügen
          </Link>
        ) : null}
      </div>

      {/* Result count */}
      {isFiltered ? (
        <p className="text-sm text-[var(--muted)]">
          {totalShown} von {grandTotal} Einträgen
        </p>
      ) : null}

      {/* List */}
      {grandTotal === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          heading="Noch keine Personen mit Zugang"
          description="Füge die erste Person hinzu, um Zugang zu SportClubEvo zu vergeben."
        />
      ) : totalShown === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10" />}
          heading="Keine Treffer"
          description="Für die gewählten Filter wurden keine Einträge gefunden."
          action={
            isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                }}
                className="fca-button-secondary text-sm"
              >
                Filter zurücksetzen
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {/* Table header */}
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_100px_40px] gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:grid">
            <span>Person</span>
            <span>Zugriff</span>
            <span>Status</span>
            <span>Letzter Login</span>
            <span />
          </div>

          {/* User rows */}
          {filteredUsers.map((user, idx) => {
            const isLast = idx === filteredUsers.length - 1 && filteredPersons.length === 0;
            const isCurrentUser = user.userId === currentUserId;
            const status = getAccessStatusLabel(user);

            return (
              <div
                key={user.userId}
                className={`group relative flex flex-col gap-3 px-5 py-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_100px_40px] md:items-center md:gap-4 hover:bg-[var(--surface-2)] transition-colors ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <Link
                  href={`/dashboard/admin/users/${user.userId}`}
                  className="absolute inset-0"
                  aria-label={`${user.name} öffnen`}
                  tabIndex={-1}
                />

                <div className="relative flex min-w-0 items-center gap-3 pointer-events-none">
                  <AdminAvatar name={user.name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {user.name}
                      </span>
                      {isCurrentUser ? (
                        <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[0.65rem] font-semibold text-amber-700">
                          Ich
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>

                <div className="relative space-y-1 pointer-events-none">
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <span key={role.id} className={getRoleBadgeClass(role.key)}>
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Keine Rolle</span>
                    )}
                  </div>
                  {user.scopedRoles && user.scopedRoles.length > 0 ? (
                    <p className="text-[11px] text-[var(--muted)]">
                      {user.scopedRoles
                        .map((s) => `${s.name} · ${s.orgUnitName}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>

                <div className="relative pointer-events-none">
                  <AdminStatusPill label={status.label} tone={status.tone} />
                </div>

                <div className="relative text-xs text-[var(--muted)] pointer-events-none">
                  {formatLastLogin(user.lastLoginAt)}
                </div>

                <div className="relative flex justify-end">
                  <UserRowActionsMenu
                    userId={user.userId}
                    userName={user.name}
                    userEmail={user.email}
                    pendingInvitation={user.pendingInvitation}
                    canManageMembership={canManage}
                    canGlobalDelete={canGlobalDelete}
                    isSelf={isCurrentUser}
                    linkedPersonName={user.linkedPersonName ?? null}
                    tenantRoleNames={user.roles.map((r) => r.name)}
                  />
                </div>
              </div>
            );
          })}

          {/* Person-only rows (no user account) */}
          {filteredPersons.map((person, idx) => {
            const isLast = idx === filteredPersons.length - 1;
            return (
              <div
                key={person.personId}
                className={`flex flex-col gap-3 px-5 py-4 md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_100px_40px] md:items-center md:gap-4 bg-[var(--surface-2)]/40 ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AdminAvatar name={person.name} size="sm" />
                  <div className="min-w-0">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {person.name}
                    </span>
                    {person.email ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{person.email}</p>
                    ) : (
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)] italic">Keine E-Mail</p>
                    )}
                  </div>
                </div>

                <div className="text-xs text-[var(--muted)]">—</div>

                <div>
                  <AdminStatusPill label="Nicht eingeladen" tone="muted" />
                </div>

                <div className="text-xs text-[var(--muted)]">—</div>

                <div className="flex justify-end">
                  {canInvite ? (
                    <Link
                      href={`/dashboard/admin/people-access/new?personId=${person.personId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--blue,#2563EB)] hover:underline"
                    >
                      Zugang einrichten
                    </Link>
                  ) : (
                    <Link
                      href={`/dashboard/persons/${person.personId}`}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Öffnen
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
