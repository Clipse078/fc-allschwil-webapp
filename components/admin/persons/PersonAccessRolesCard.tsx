"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, KeyRound, Link2, Loader2, Mail, Search, Unlink } from "lucide-react";
import ProtectedRoleBadge from "@/components/admin/roles/ProtectedRoleBadge";

export type PersonAccessRole = {
  id: string;
  name: string;
  isSystem: boolean;
  isArchived: boolean;
};

export type PersonAccessLinkedUser = {
  id: string;
  email: string;
};

export type LinkableTenantUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Props = {
  personId: string;
  linkedUser: PersonAccessLinkedUser | null;
  /** True when the linked User has an active TenantMembership in the
   * caller's active tenant. Irrelevant when linkedUser is null. */
  isActiveTenantMember: boolean;
  /** TENANT-scoped roles for the caller's active tenant only — never
   * PLATFORM roles and never another tenant's roles (see
   * getTenantRolesOverview()). */
  roles: PersonAccessRole[];
  /** Role ids currently assigned to linkedUser in this tenant. */
  assignedRoleIds: string[];
  /** Live roles.manage / roles.assign check for the caller — gates
   * mutation only (role assign/remove AND account link/unlink); viewing
   * the current roles never requires it here. Deliberately the same
   * authority for linking as for role assignment — no second permission
   * is introduced (ADMIN-MASTERDATA-UX-01-C1). */
  canAssign: boolean;
};

/**
 * ADMIN-MASTERDATA-UX-01 / -C1 — Person detail "Zugang & Rollen" card.
 *
 * Deliberately thin: it never invents a second permission model. Every
 * assign/remove action goes through the exact same
 * POST/DELETE /api/tenant/roles/[id]/members endpoints the
 * "Benutzerzuweisungen" tab (RoleAssignmentPanel) already uses — this
 * component only ever toggles one already-known `userId` (resolved from
 * `Person.userId`) instead of letting the caller pick a member from a
 * list. The server route re-validates active membership, tenant/role
 * ownership, archived state, and the last-required-admin guard on every
 * call; this component only reflects the server's response.
 *
 * -C1: when unlinked, also offers "Benutzerkonto verknüpfen" — a search
 * over the exact same eligible-user universe as tenant role assignment
 * (active TenantMembership in this tenant, never PLATFORM-only or
 * cross-tenant), further excluding Users already linked to another
 * Person. Link/unlink go through POST/DELETE /api/people/[id]/link-user,
 * which only ever writes Person.userId — never a User, TenantMembership,
 * or UserRole row.
 */
export default function PersonAccessRolesCard({
  personId,
  linkedUser,
  isActiveTenantMember,
  roles,
  assignedRoleIds,
  canAssign,
}: Props) {
  const router = useRouter();
  const [roleIds, setRoleIds] = useState(assignedRoleIds);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = useMemo(() => roles.filter((r) => !r.isArchived), [roles]);

  async function toggleRole(roleId: string, currentlyAssigned: boolean) {
    if (!linkedUser || !canAssign) return;
    setPendingRoleId(roleId);
    setError(null);

    try {
      const res = currentlyAssigned
        ? await fetch(
            `/api/tenant/roles/${roleId}/members?userId=${encodeURIComponent(linkedUser.id)}`,
            { method: "DELETE" },
          )
        : await fetch(`/api/tenant/roles/${roleId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: linkedUser.id }),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Aktion fehlgeschlagen.");
        return;
      }

      setRoleIds((prev) =>
        currentlyAssigned ? prev.filter((id) => id !== roleId) : Array.from(new Set([...prev, roleId])),
      );
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPendingRoleId(null);
    }
  }

  async function handleUnlink() {
    if (!linkedUser) return;
    const confirmed = window.confirm(
      "Verknüpfung zu diesem Benutzerkonto wirklich lösen? Das Benutzerkonto, seine Mandantenmitgliedschaft und seine Rollen bleiben davon unberührt.",
    );
    if (!confirmed) return;

    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/link-user`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Verknüpfung konnte nicht gelöst werden.");
        return;
      }
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    }
  }

  if (!linkedUser) {
    return (
      <PersonUserLinkPicker personId={personId} canLink={canAssign} onLinked={() => router.refresh()} />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Verknüpftes Benutzerkonto</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            {linkedUser.email}
          </p>
          {canAssign ? (
            <button
              type="button"
              onClick={handleUnlink}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-rose-600"
            >
              <Unlink className="h-3 w-3" />
              Verknüpfung lösen
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
          <p className="text-[0.78rem] font-medium text-rose-700">{error}</p>
        </div>
      ) : null}

      {!isActiveTenantMember ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[0.8rem] text-[var(--muted)]">
          Dieses Konto ist kein aktives Mitglied des aktuellen Mandanten. Mandantenrollen können hier
          nicht verwaltet werden.
        </p>
      ) : (
        <>
          {!canAssign ? (
            <p className="text-[0.72rem] text-[var(--muted)]">
              Keine Berechtigung zum Zuweisen von Rollen.
            </p>
          ) : null}

          {assignableRoles.length === 0 ? (
            <p className="py-3 text-center text-[0.8rem] text-[var(--muted)]">
              Keine aktiven Mandantenrollen verfügbar.
            </p>
          ) : (
            <div className="space-y-1.5">
              {assignableRoles.map((role) => {
                const isAssigned = roleIds.includes(role.id);
                const isPending = pendingRoleId === role.id;

                if (!canAssign) {
                  return (
                    <div
                      key={role.id}
                      className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    >
                      <span className="flex-1 text-[0.82rem] font-medium text-[var(--foreground)]">
                        {role.name}
                        {role.isSystem ? <span className="ml-1.5 inline-block"><ProtectedRoleBadge /></span> : null}
                      </span>
                      {isAssigned ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : null}
                    </div>
                  );
                }

                return (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition hover:border-[var(--blue)] hover:bg-[var(--blue-light)]"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={isPending}
                      onChange={() => toggleRole(role.id, isAssigned)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--blue)]"
                      aria-label={`Rolle ${role.name} ${isAssigned ? "entziehen" : "zuweisen"}`}
                    />
                    <span className="flex-1 text-[0.82rem] font-medium text-[var(--foreground)]">
                      {role.name}
                      {role.isSystem ? <span className="ml-1.5 inline-block"><ProtectedRoleBadge /></span> : null}
                    </span>
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--muted)]" />
                    ) : isAssigned ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * ADMIN-MASTERDATA-UX-01-C1 — "Benutzerkonto verknüpfen".
 *
 * Rendered only in place of the (formerly static) "Kein Benutzerkonto
 * verknüpft" state. Fetches the eligible-user list lazily (only when a
 * caller with link authority actually opens the picker) from
 * GET /api/people/linkable-users, then filters client-side — same UX
 * pattern as RoleAssignmentPanel's member search, no new framework.
 */
function PersonUserLinkPicker({
  personId,
  canLink,
  onLinked,
}: {
  personId: string;
  canLink: boolean;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<LinkableTenantUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || users !== null) return;
    let isMounted = true;
    setLoading(true);
    fetch("/api/people/linkable-users")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setUsers(Array.isArray(data?.users) ? data.users : []);
      })
      .catch(() => {
        if (isMounted) setError("Benutzer konnten nicht geladen werden.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [open, users]);

  const filtered = useMemo(() => {
    const list = users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  async function handleLink(userId: string) {
    setPendingUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/link-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Verknüpfung fehlgeschlagen.");
        return;
      }
      onLinked();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPendingUserId(null);
    }
  }

  if (!canLink) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm text-[var(--muted)]">
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        Kein Benutzerkonto verknüpft
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm text-[var(--muted)]">
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          Kein Benutzerkonto verknüpft
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
        >
          <Link2 className="h-3.5 w-3.5" />
          Benutzerkonto verknüpfen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--foreground)]">Benutzerkonto verknüpfen</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[0.72rem] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Abbrechen
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
          <p className="text-[0.78rem] font-medium text-rose-700">{error}</p>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Benutzer suchen…"
          className="fca-input w-full pl-8 text-sm"
          aria-label="Benutzer suchen"
        />
      </div>

      {loading ? (
        <p className="py-4 text-center text-[0.8rem] text-[var(--muted)]">Lädt…</p>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-[0.8rem] text-[var(--muted)]">
          Keine verfügbaren Benutzer für dieses Mandat gefunden.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.userId} className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.82rem] font-medium text-[var(--foreground)]">
                  {u.firstName} {u.lastName}
                </p>
                <p className="truncate text-[0.7rem] text-[var(--muted)]">{u.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLink(u.userId)}
                disabled={pendingUserId === u.userId}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--blue)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--blue)] transition hover:bg-[var(--blue-light)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingUserId === u.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                Verknüpfen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
