"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronUp, Loader2, Pencil, UserPlus, Users } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import OrgMembershipPicker from "@/components/admin/org/OrgMembershipPicker";

type MembershipUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type MembershipPerson = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
};

export type Membership = {
  id: string;
  userId: string | null;
  personId: string | null;
  roleKey: string | null;
  isPrimary: boolean;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  user: MembershipUser | null;
  person: MembershipPerson | null;
};

export type RoleSummary = { id: string; key: string; name: string };

type OrgMembershipManagementCardProps = {
  orgUnitId: string;
  initialMemberships: Membership[];
  roles: RoleSummary[];
};

function resolveRoleName(roleKey: string | null, roles: RoleSummary[]): string | null {
  if (!roleKey) return null;
  const match = roles.find((r) => r.key === roleKey);
  // If no matching Role record, fall back to the raw key (backward compat for old free-text values).
  return match ? match.name : roleKey;
}

function getMemberTitle(m: Membership): string {
  if (m.user) return `${m.user.firstName} ${m.user.lastName}`;
  if (m.person) return m.person.displayName || `${m.person.firstName} ${m.person.lastName}`;
  if (m.userId) return `User: ${m.userId.substring(0, 8)}…`;
  if (m.personId) return `Person: ${m.personId.substring(0, 8)}…`;
  return "Nicht zugewiesen";
}

function getMemberSubtitle(m: Membership): string | undefined {
  if (m.user?.email) return m.user.email;
  if (m.person?.email) return m.person.email;
  return undefined;
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMemberPeriod(m: Membership): string | null {
  const start = formatDate(m.startsAt);
  const end = formatDate(m.endsAt);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Ab ${start}`;
  if (end) return `Bis ${end}`;
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  PENDING: "Ausstehend",
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function getStatusTone(status: string): "success" | "warning" | "muted" | "default" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warning";
  return "muted";
}

export default function OrgMembershipManagementCard({
  orgUnitId,
  initialMemberships,
  roles,
}: OrgMembershipManagementCardProps) {
  const router = useRouter();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Inline role edit state
  const [editingRoleMemberId, setEditingRoleMemberId] = useState<string | null>(null);
  const [editingRoleKey, setEditingRoleKey] = useState("");
  const [roleEditSubmitting, setRoleEditSubmitting] = useState(false);
  const [roleEditError, setRoleEditError] = useState<string | null>(null);

  function startRoleEdit(m: Membership) {
    setEditingRoleMemberId(m.id);
    setEditingRoleKey(m.roleKey ?? "");
    setRoleEditError(null);
  }

  function cancelRoleEdit() {
    setEditingRoleMemberId(null);
    setRoleEditError(null);
  }

  async function handleRoleSave(membershipId: string) {
    setRoleEditSubmitting(true);
    setRoleEditError(null);
    try {
      const res = await fetch(`/api/org-units/${orgUnitId}/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey: editingRoleKey || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRoleEditError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setEditingRoleMemberId(null);
      router.refresh();
    } catch {
      setRoleEditError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRoleEditSubmitting(false);
    }
  }

  const existingMemberUserIds = initialMemberships
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  const existingMemberPersonIds = initialMemberships
    .map((m) => m.personId)
    .filter((id): id is string => id !== null);

  function handleAdded() {
    setAddPanelOpen(false);
    router.refresh();
  }

  async function handleRemove(m: Membership) {
    const name = getMemberTitle(m);
    if (!window.confirm(`Mitgliedschaft von „${name}" wirklich entfernen?`)) return;

    setRemovingId(m.id);
    setRemoveError(null);

    try {
      const res = await fetch(`/api/org-units/${orgUnitId}/memberships/${m.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveError(data?.error ?? "Mitgliedschaft konnte nicht entfernt werden.");
        return;
      }
      router.refresh();
    } catch {
      setRemoveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="sce-detail-section">
      {/* Header */}
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Mitglieder
          </p>
          <span className="sce-count-badge">{initialMemberships.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setAddPanelOpen((v) => !v)}
          className="fca-button-primary"
        >
          {addPanelOpen ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Schließen
            </>
          ) : (
            <>
              <UserPlus className="h-3.5 w-3.5" />
              Mitglied hinzufügen
            </>
          )}
        </button>
      </div>

      {/* Add panel */}
      {addPanelOpen ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-5">
          <OrgMembershipPicker
            orgUnitId={orgUnitId}
            existingMemberUserIds={existingMemberUserIds}
            existingMemberPersonIds={existingMemberPersonIds}
            onAdded={handleAdded}
            roles={roles}
          />
        </div>
      ) : null}

      {/* Remove error */}
      {removeError ? (
        <div className="mx-5 mt-4 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {removeError}
        </div>
      ) : null}

      {/* Member list */}
      {initialMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <Users className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Noch keine Mitglieder
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Mitglieder über die Schaltfläche oben zuordnen.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {initialMemberships.map((m) => {
            const title = getMemberTitle(m);
            const subtitle = getMemberSubtitle(m);
            const period = getMemberPeriod(m);
            const resolvedRole = resolveRoleName(m.roleKey, roles);
            const isEditingRole = editingRoleMemberId === m.id;

            return (
              <div key={m.id} className="flex items-start gap-4 px-5 py-4">
                <AdminAvatar name={title} size="sm" />

                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Name + type badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {title}
                    </p>
                    {m.user ? (
                      <span
                        className="sce-role-badge"
                        style={{
                          background: "rgba(11,74,162,0.08)",
                          color: "var(--blue)",
                          border: "1px solid rgba(11,74,162,0.18)",
                        }}
                      >
                        App-Benutzer
                      </span>
                    ) : (
                      <span className="sce-role-badge sce-role-badge-member">Person</span>
                    )}
                  </div>

                  {/* Subtitle (email) */}
                  {subtitle ? (
                    <p className="text-xs text-[var(--muted)]">{subtitle}</p>
                  ) : null}

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {/* Status */}
                    <AdminStatusPill
                      label={getStatusLabel(m.status)}
                      tone={getStatusTone(m.status)}
                    />

                    {/* Role — inline picker or resolved display */}
                    {isEditingRole ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={editingRoleKey}
                          onChange={(e) => setEditingRoleKey(e.target.value)}
                          className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--blue)]"
                        >
                          <option value="">— Keine Rolle —</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.key}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRoleSave(m.id)}
                          disabled={roleEditSubmitting}
                          className="inline-flex items-center gap-1 rounded bg-[var(--blue)] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {roleEditSubmitting ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : null}
                          {roleEditSubmitting ? "…" : "OK"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRoleEdit}
                          className="text-[10px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {resolvedRole ? (
                          <span className="sce-role-badge sce-role-badge-staff">
                            {resolvedRole}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => startRoleEdit(m)}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                          title="Rolle bearbeiten"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {resolvedRole ? null : "Rolle"}
                        </button>
                      </div>
                    )}

                    {/* Primary badge */}
                    {m.isPrimary ? (
                      <span
                        className="sce-role-badge"
                        style={{
                          background: "rgba(11,74,162,0.10)",
                          color: "var(--blue)",
                          border: "1px solid rgba(11,74,162,0.20)",
                        }}
                      >
                        Primär
                      </span>
                    ) : null}

                    {/* Period */}
                    {period ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <CalendarRange className="h-3 w-3" />
                        {period}
                      </span>
                    ) : null}
                  </div>

                  {/* Role edit error (shown below metadata row for the active row) */}
                  {isEditingRole && roleEditError ? (
                    <p className="text-[11px] font-medium text-rose-600">{roleEditError}</p>
                  ) : null}
                </div>

                {/* Remove action */}
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  disabled={removingId === m.id}
                  className="mt-0.5 flex-shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingId === m.id ? "Entfernen…" : "Entfernen"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
