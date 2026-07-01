"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, UserX } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { EmptyState } from "@/components/ui/page";

type UserItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
};

type UsersSearchableListProps = {
  currentUserId: string;
  initialUsers: UserItem[];
};

function getRoleBadgeClass(roleName: string): string {
  const n = roleName.toLowerCase();
  if (n.includes("superadmin")) return "sce-role-badge sce-role-badge-admin";
  if (n.includes("admin")) return "sce-role-badge sce-role-badge-admin";
  if (n.includes("trainer")) return "sce-role-badge sce-role-badge-trainer";
  if (n.includes("staff")) return "sce-role-badge sce-role-badge-staff";
  return "sce-role-badge sce-role-badge-member";
}


export default function UsersSearchableList({
  currentUserId,
  initialUsers,
}: UsersSearchableListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialUsers;
    return initialUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roles.some((r) => r.toLowerCase().includes(q)),
    );
  }, [initialUsers, query]);

  const activeCount = initialUsers.filter((u) => u.isActive).length;
  const withRolesCount = initialUsers.filter((u) => u.roles.length > 0).length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Benutzer</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {initialUsers.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktiv</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Konten</p>
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

      {/* Search */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Benutzer suchen nach Name, E-Mail oder Rolle…"
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

      {/* Result count */}
      {query.trim() ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {initialUsers.length} Benutzern
        </p>
      ) : null}

      {/* List */}
      {initialUsers.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10" />}
          heading="Noch keine Benutzer"
          description="Noch keine Benutzerkonten erfasst. Über die Schaltfläche oben rechts den ersten anlegen."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          heading="Keine Treffer"
          description={`Für „${query}" wurden keine Benutzer gefunden.`}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {filtered.map((user, idx) => {
            const isLast = idx === filtered.length - 1;
            const isCurrentUser = user.id === currentUserId;

            return (
              <Link
                key={user.id}
                href={`/dashboard/users/${user.id}`}
                className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)] ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {/* Avatar */}
                <AdminAvatar name={user.name} size="sm" />

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {user.name}
                    </span>
                    {isCurrentUser ? (
                      <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-[0.65rem] font-semibold text-amber-700">
                        Ich
                      </span>
                    ) : null}
                    {user.roles.length > 0
                      ? user.roles.map((role) => (
                          <span key={role} className={getRoleBadgeClass(role)}>
                            {role}
                          </span>
                        ))
                      : null}
                    {user.roles.length === 0 ? (
                      <span className="sce-role-badge sce-role-badge-member opacity-50">
                        Keine Rolle
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {user.email}
                  </p>
                </div>

                {/* Status + chevron */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  <AdminStatusPill
                    label={user.isActive ? "Aktiv" : "Inaktiv"}
                    tone={user.isActive ? "success" : "muted"}
                  />
                  <ChevronRight className="h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--blue)]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
