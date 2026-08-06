"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Search, ShieldCheck, User } from "lucide-react";
import ProtectedRoleBadge from "@/components/admin/roles/ProtectedRoleBadge";

export type AssignmentMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleIds: string[];
};

export type AssignmentRole = {
  id: string;
  name: string;
  isSystem: boolean;
  isArchived: boolean;
};

type Props = {
  initialMembers: AssignmentMember[];
  roles: AssignmentRole[];
};

/**
 * Tenant role ↔ member assignment UI (RPERM-05 "Benutzerzuweisungen" tab).
 *
 * Member list is sourced exclusively from `TenantMembership` (passed down
 * from `getEligibleTenantMembers`) — never `User.tenantId`. Every
 * assign/remove call hits `POST`/`DELETE /api/tenant/roles/[id]/members`,
 * which re-validates active membership, role ownership, archived state,
 * and the last-required-admin guard server-side; this component only
 * reflects the server's response, it never grants access on its own.
 */
export default function RoleAssignmentPanel({ initialMembers, roles }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialMembers[0]?.userId ?? null,
  );
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = useMemo(() => roles.filter((r) => !r.isArchived), [roles]);
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  const selectedMember = members.find((m) => m.userId === selectedUserId) ?? null;

  async function toggleRole(roleId: string, currentlyAssigned: boolean) {
    if (!selectedMember) return;
    setPendingRoleId(roleId);
    setError(null);

    try {
      const res = currentlyAssigned
        ? await fetch(
            `/api/tenant/roles/${roleId}/members?userId=${encodeURIComponent(selectedMember.userId)}`,
            { method: "DELETE" },
          )
        : await fetch(`/api/tenant/roles/${roleId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: selectedMember.userId }),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Aktion fehlgeschlagen.");
        return;
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.userId !== selectedMember.userId
            ? m
            : {
                ...m,
                roleIds: currentlyAssigned
                  ? m.roleIds.filter((id) => id !== roleId)
                  : Array.from(new Set([...m.roleIds, roleId])),
              },
        ),
      );
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setPendingRoleId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-sm font-semibold text-[var(--foreground)]">Aktive Mitglieder</p>
          <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
            {members.length}
          </span>
        </div>
        <div className="sce-detail-section-body space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mitglied suchen…"
              className="fca-input w-full pl-9"
              aria-label="Mitglied suchen"
            />
          </div>
          {filteredMembers.length === 0 ? (
            <p className="py-6 text-center text-[0.8rem] text-[var(--muted)]">
              Keine aktiven Mitglieder gefunden.
            </p>
          ) : (
            <ul className="max-h-[480px] space-y-1 overflow-y-auto">
              {filteredMembers.map((member) => (
                <li key={member.userId}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(member.userId)}
                    className={`flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors ${
                      member.userId === selectedUserId
                        ? "bg-[var(--blue-light)] text-[var(--blue)]"
                        : "hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.82rem] font-medium">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="block truncate text-[0.7rem] text-[var(--muted)]">
                        {member.email}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.68rem] font-semibold text-[var(--muted)]">
                      {member.roleIds.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : "Kein Mitglied ausgewählt"}
            </p>
          </div>
        </div>
        <div className="sce-detail-section-body space-y-3">
          {error && (
            <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[12px] font-medium text-rose-700">{error}</p>
            </div>
          )}

          {!selectedMember ? (
            <p className="py-8 text-center text-[0.82rem] text-[var(--muted)]">
              Wähle links ein Mitglied aus, um Rollen zuzuweisen.
            </p>
          ) : assignableRoles.length === 0 ? (
            <p className="py-8 text-center text-[0.82rem] text-[var(--muted)]">
              Keine aktiven Rollen für diesen Mandanten verfügbar.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {assignableRoles.map((role) => {
                const isAssigned = selectedMember.roleIds.includes(role.id);
                const isPending = pendingRoleId === role.id;
                return (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-[var(--blue)] hover:bg-[var(--blue-light)]"
                  >
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={isPending}
                      onChange={() => toggleRole(role.id, isAssigned)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--blue)]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.82rem] font-semibold text-[var(--foreground)]">
                        {role.name}
                        {role.isSystem && <ProtectedRoleBadge />}
                      </span>
                    </div>
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
        </div>
      </div>
    </div>
  );
}
