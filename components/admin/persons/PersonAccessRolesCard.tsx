"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, KeyRound, Loader2, Mail } from "lucide-react";
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

type Props = {
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
   * mutation only; viewing the current roles never requires it here. */
  canAssign: boolean;
};

/**
 * ADMIN-MASTERDATA-UX-01 — Person detail "Zugang & Rollen" card.
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
 */
export default function PersonAccessRolesCard({
  linkedUser,
  isActiveTenantMember,
  roles,
  assignedRoleIds,
  canAssign,
}: Props) {
  const [roleIds, setRoleIds] = useState(assignedRoleIds);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = useMemo(() => roles.filter((r) => !r.isArchived), [roles]);

  if (!linkedUser) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm text-[var(--muted)]">
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        Kein Benutzerkonto verknüpft
      </div>
    );
  }

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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Verknüpftes Benutzerkonto</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
          <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          {linkedUser.email}
        </p>
      </div>

      {!isActiveTenantMember ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[0.8rem] text-[var(--muted)]">
          Dieses Konto ist kein aktives Mitglied des aktuellen Mandanten. Mandantenrollen können hier
          nicht verwaltet werden.
        </p>
      ) : (
        <>
          {error ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
              <p className="text-[0.78rem] font-medium text-rose-700">{error}</p>
            </div>
          ) : null}

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
