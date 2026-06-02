"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  ChevronUp,
  Loader2,
  Pencil,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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

type StatusFilter = "all" | "ACTIVE" | "INACTIVE" | "PENDING";

type OrgMembershipManagementCardProps = {
  orgUnitId: string;
  initialMemberships: Membership[];
};

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

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "ACTIVE", label: "Aktiv" },
  { key: "INACTIVE", label: "Inaktiv" },
  { key: "PENDING", label: "Ausstehend" },
];

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

type InlineEditRowProps = {
  orgUnitId: string;
  membership: Membership;
  onSaved: () => void;
  onCancel: () => void;
};

function InlineEditRow({ orgUnitId, membership, onSaved, onCancel }: InlineEditRowProps) {
  const [roleKey, setRoleKey] = useState(membership.roleKey ?? "");
  const [status, setStatus] = useState(membership.status);
  const [isPrimary, setIsPrimary] = useState(membership.isPrimary);
  const [startsAt, setStartsAt] = useState(
    membership.startsAt ? new Date(membership.startsAt).toISOString().split("T")[0] : ""
  );
  const [endsAt, setEndsAt] = useState(
    membership.endsAt ? new Date(membership.endsAt).toISOString().split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/org-units/${orgUnitId}/memberships/${membership.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleKey: roleKey.trim() || null,
            status,
            isPrimary,
            startsAt: startsAt || undefined,
            endsAt: endsAt || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      onSaved();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1";

  return (
    <div className="bg-[var(--surface-2)] px-5 py-4 border-b border-[var(--border)]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Role */}
        <div>
          <label className={labelClass}>Rolle</label>
          <input
            type="text"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            placeholder="z.B. Kassier, Präsident…"
            className="fca-input"
          />
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="fca-select"
          >
            <option value="ACTIVE">Aktiv</option>
            <option value="INACTIVE">Inaktiv</option>
            <option value="PENDING">Ausstehend</option>
          </select>
        </div>

        {/* Starts at */}
        <div>
          <label className={labelClass}>Gültig ab</label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="fca-input"
          />
        </div>

        {/* Ends at */}
        <div>
          <label className={labelClass}>Gültig bis</label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="fca-input"
          />
        </div>
      </div>

      {/* Primary toggle */}
      <div className="mt-3 flex items-center gap-3">
        <input
          type="checkbox"
          id={`isPrimary-${membership.id}`}
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="fca-toggle-checkbox"
        />
        <label
          htmlFor={`isPrimary-${membership.id}`}
          className="text-sm font-medium text-[var(--text-2)]"
        >
          Primäres Mitglied
        </label>
      </div>

      {/* Error */}
      {error ? (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="fca-button-primary"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function OrgMembershipManagementCard({
  orgUnitId,
  initialMemberships,
}: OrgMembershipManagementCardProps) {
  const router = useRouter();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const existingMemberUserIds = initialMemberships
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  const existingMemberPersonIds = initialMemberships
    .map((m) => m.personId)
    .filter((id): id is string => id !== null);

  const filteredMemberships =
    statusFilter === "all"
      ? initialMemberships
      : initialMemberships.filter((m) => m.status === statusFilter);

  const countsByStatus = {
    all: initialMemberships.length,
    ACTIVE: initialMemberships.filter((m) => m.status === "ACTIVE").length,
    INACTIVE: initialMemberships.filter((m) => m.status === "INACTIVE").length,
    PENDING: initialMemberships.filter((m) => m.status === "PENDING").length,
  };

  function handleAdded() {
    setAddPanelOpen(false);
    router.refresh();
  }

  function handleSaved() {
    setEditingId(null);
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
          />
        </div>
      ) : null}

      {/* Remove error */}
      {removeError ? (
        <div className="mx-5 mt-4 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {removeError}
          <button
            type="button"
            onClick={() => setRemoveError(null)}
            className="ml-2 opacity-60 hover:opacity-100"
            aria-label="Fehler schließen"
          >
            <X className="inline h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Status filter tabs */}
      {initialMemberships.length > 0 ? (
        <div className="flex gap-1 border-b border-[var(--border)] px-5 pt-3 pb-0">
          {FILTER_TABS.map((tab) => {
            const count = countsByStatus[tab.key];
            if (tab.key !== "all" && count === 0) return null;
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-[12px] font-semibold transition ${
                  isActive
                    ? "border-[var(--blue)] text-[var(--blue)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
                {count > 0 ? (
                  <span
                    className={`inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--blue)] text-white"
                        : "bg-[var(--surface-3)] text-[var(--text-2)]"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Empty state */}
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
      ) : filteredMemberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Keine Mitglieder in diesem Status
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="text-xs text-[var(--blue)] hover:underline"
          >
            Alle anzeigen
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {filteredMemberships.map((m) => {
            const title = getMemberTitle(m);
            const subtitle = getMemberSubtitle(m);
            const period = getMemberPeriod(m);
            const isEditing = editingId === m.id;

            return (
              <div key={m.id}>
                <div className="flex items-start gap-4 px-5 py-4">
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
                      <AdminStatusPill
                        label={getStatusLabel(m.status)}
                        tone={getStatusTone(m.status)}
                      />
                      {m.roleKey ? (
                        <span className="sce-role-badge sce-role-badge-staff">
                          {m.roleKey}
                        </span>
                      ) : null}
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
                      {period ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                          <CalendarRange className="h-3 w-3" />
                          {period}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-0.5 flex flex-shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(isEditing ? null : m.id)
                      }
                      title={isEditing ? "Bearbeitung abbrechen" : "Bearbeiten"}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                        isEditing
                          ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]"
                          : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:border-[var(--blue)] hover:bg-[var(--blue-light)] hover:text-[var(--blue)]"
                      }`}
                      aria-pressed={isEditing}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(m)}
                      disabled={removingId === m.id}
                      title="Mitgliedschaft entfernen"
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {removingId === m.id ? "Entfernen…" : "Entfernen"}
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {isEditing ? (
                  <InlineEditRow
                    orgUnitId={orgUnitId}
                    membership={m}
                    onSaved={handleSaved}
                    onCancel={() => setEditingId(null)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
