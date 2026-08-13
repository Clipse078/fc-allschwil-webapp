"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Users, UserX } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { EmptyState } from "@/components/ui/page/EmptyState";
import type { TenantUserItem } from "@/lib/users/queries";

type Props = {
  initialUsers: TenantUserItem[];
  currentUserId: string;
};

function getRoleBadgeClass(roleKey: string): string {
  const k = roleKey.toLowerCase();
  if (k.includes("superadmin") || k.includes("super_admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("admin")) return "sce-role-badge sce-role-badge-admin";
  if (k.includes("trainer")) return "sce-role-badge sce-role-badge-trainer";
  if (k.includes("staff")) return "sce-role-badge sce-role-badge-staff";
  return "sce-role-badge sce-role-badge-member";
}

type StatusFilter = "all" | "active" | "inactive";

export default function TenantUsersSearchableList({ initialUsers, currentUserId }: Props) {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialUsers.filter((u) => {
      // Status filter
      const isEffectivelyActive = u.membershipIsActive && u.userIsActive;
      if (statusFilter === "active" && !isEffectivelyActive) return false;
      if (statusFilter === "inactive" && isEffectivelyActive) return false;

      // Role filter
      if (roleFilter !== "all" && !u.roles.some((r) => r.id === roleFilter)) return false;

      // Search
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

  const activeCount = initialUsers.filter((u) => u.membershipIsActive && u.userIsActive).length;
  const inactiveCount = initialUsers.length - activeCount;
  const withRolesCount = initialUsers.filter((u) => u.roles.length > 0).length;

  const isFiltered = query.trim() !== "" || statusFilter !== "all" || roleFilter !== "all";

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Mitglieder</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {initialUsers.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Gesamt</p>
        </div>
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
          <p className="sce-data-label">Mit Rollen</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {withRolesCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">mit Zuweisung</p>
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
          <option value="inactive">Inaktiv ({inactiveCount})</option>
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
      </div>

      {/* Result count */}
      {isFiltered ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {initialUsers.length} Benutzer
          {initialUsers.length !== 1 ? "n" : ""}
        </p>
      ) : null}

      {/* List */}
      {initialUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          heading="Noch keine Benutzer"
          description="Diesem Club sind noch keine Benutzerkonten zugeordnet."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10" />}
          heading="Keine Treffer"
          description={
            isFiltered
              ? "Für die gewählten Filter wurden keine Benutzer gefunden. Filter zurücksetzen und erneut versuchen."
              : `Für „${query}" wurden keine Benutzer gefunden.`
          }
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
          <div className="hidden grid-cols-[1fr_140px_1fr_140px] gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:grid">
            <span>Benutzer</span>
            <span>Status</span>
            <span>Rollen</span>
            <span>Zugriff</span>
          </div>

          {filtered.map((user, idx) => {
            const isLast = idx === filtered.length - 1;
            const isCurrentUser = user.userId === currentUserId;
            const isEffectivelyActive = user.membershipIsActive && user.userIsActive;
            const membershipOnly = !user.membershipIsActive && user.userIsActive;
            const accountOnly = user.membershipIsActive && !user.userIsActive;

            return (
              <Link
                key={user.userId}
                href={`/dashboard/admin/users/${user.userId}`}
                className={`flex flex-col gap-3 px-5 py-4 md:grid md:grid-cols-[1fr_140px_1fr_140px] md:items-center md:gap-4 hover:bg-[var(--surface-2)] transition-colors ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {/* Benutzer column */}
                <div className="flex min-w-0 items-center gap-3">
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

                {/* Status column */}
                <div>
                  <AdminStatusPill
                    label={isEffectivelyActive ? "Aktiv" : "Inaktiv"}
                    tone={isEffectivelyActive ? "success" : "muted"}
                  />
                </div>

                {/* Rollen column */}
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span key={role.id} className={getRoleBadgeClass(role.key)}>
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <span className="sce-role-badge sce-role-badge-member opacity-50">
                      Keine Rolle
                    </span>
                  )}
                </div>

                {/* Zugriff column */}
                <div className="flex flex-wrap gap-1.5">
                  {isEffectivelyActive ? (
                    <AdminStatusPill label="Mitglied" tone="success" />
                  ) : membershipOnly ? (
                    <AdminStatusPill label="Konto inaktiv" tone="warning" />
                  ) : accountOnly ? (
                    <AdminStatusPill label="Zugriff gesperrt" tone="muted" />
                  ) : (
                    <AdminStatusPill label="Inaktiv" tone="muted" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
