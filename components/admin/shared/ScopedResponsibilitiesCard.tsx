"use client";

/**
 * ScopedResponsibilitiesCard — ORG-ACCESS-02
 *
 * Renders "Personen & Zuständigkeiten" for an OrgUnit context (OrgUnit page
 * or Team page).
 *
 * Props:
 *   orgUnitId          — canonical OrgUnit for the scope
 *   orgUnitName        — display name of the scope
 *   initialAssignments — current scoped UserRole rows (server-rendered)
 *   availableRoles     — TENANT roles to offer (Club Admin excluded by server)
 *   eligibleUsers      — active tenant members eligible for assignment
 *   showScopeModeSelector — whether to show scope-mode picker (OrgUnit page = true,
 *                           Team page = false, defaults to THIS_ORG_UNIT)
 *   canManage          — whether the actor holds a management permission
 */

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronUp,
  Loader2,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type EligibleUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ScopedAssignment = {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  scopeMode: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS";
  orgUnitId: string;
  orgUnitName: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ScopedResponsibilitiesCardProps = {
  orgUnitId: string;
  orgUnitName: string;
  initialAssignments: ScopedAssignment[];
  availableRoles: RoleOption[];
  eligibleUsers: EligibleUser[];
  showScopeModeSelector?: boolean;
  canManage: boolean;
};

// ---------------------------------------------------------------------------
// Scope mode labels
// ---------------------------------------------------------------------------

const SCOPE_MODE_LABELS: Record<string, string> = {
  THIS_ORG_UNIT: "Nur dieser Bereich",
  THIS_ORG_UNIT_AND_DESCENDANTS: "Dieser Bereich und Unterbereiche",
};

// ---------------------------------------------------------------------------
// Inline user picker
// ---------------------------------------------------------------------------

type UserPickerProps = {
  eligibleUsers: EligibleUser[];
  excludeIds?: string[];
  onSelect: (user: EligibleUser) => void;
  disabled?: boolean;
};

function UserPicker({
  eligibleUsers,
  excludeIds = [],
  onSelect,
  disabled = false,
}: UserPickerProps) {
  const instanceId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = query.trim().length < 2
    ? []
    : eligibleUsers
        .filter((u) => !excludeIds.includes(u.userId))
        .filter((u) => {
          const full = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
          return full.includes(query.toLowerCase());
        })
        .slice(0, 12);

  const listboxId = `user-picker-listbox-${instanceId}`;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2">
        <Users className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Benutzer suchen…"
          disabled={disabled}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none disabled:opacity-50"
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
          aria-controls={listboxId}
        />
        {query ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">Mindestens 2 Zeichen eingeben.</p>
      ) : null}
      {open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {filtered.map((user) => (
            <li key={user.userId} role="option">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(user);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[var(--surface-2)]"
              >
                <AdminAvatar
                  name={`${user.firstName} ${user.lastName}`}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && filtered.length === 0 ? (
        <p className="mt-1 text-xs italic text-[var(--muted)]">Kein Benutzer gefunden.</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add panel
// ---------------------------------------------------------------------------

type AddPanelProps = {
  orgUnitId: string;
  eligibleUsers: EligibleUser[];
  availableRoles: RoleOption[];
  existingUserIds: string[];
  showScopeModeSelector: boolean;
  onAdded: () => void;
  onCancel: () => void;
};

function AddPanel({
  orgUnitId,
  eligibleUsers,
  availableRoles,
  existingUserIds,
  showScopeModeSelector,
  onAdded,
  onCancel,
}: AddPanelProps) {
  const [selectedUser, setSelectedUser] = useState<EligibleUser | null>(null);
  const [roleId, setRoleId] = useState("");
  const [scopeMode, setScopeMode] = useState<"THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS">(
    "THIS_ORG_UNIT",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!selectedUser || !roleId) {
      setError("Bitte Benutzer und Rolle auswählen.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/org-units/${orgUnitId}/responsibilities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUser.userId,
            roleId,
            scopeMode,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Fehler beim Zuweisen.");
          return;
        }
        onAdded();
      } catch {
        setError("Netzwerkfehler. Bitte erneut versuchen.");
      }
    });
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        Zuständigkeit zuweisen
      </p>

      {/* User picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-2)]">Benutzer</label>
        {selectedUser ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2">
            <AdminAvatar
              name={`${selectedUser.firstName} ${selectedUser.lastName}`}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {selectedUser.firstName} {selectedUser.lastName}
              </p>
              <p className="text-xs text-[var(--muted)]">{selectedUser.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--muted)] hover:bg-slate-200 hover:text-[var(--foreground)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <UserPicker
            eligibleUsers={eligibleUsers}
            excludeIds={existingUserIds}
            onSelect={setSelectedUser}
            disabled={isPending}
          />
        )}
      </div>

      {/* Role picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--text-2)]">Rolle</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          disabled={isPending || availableRoles.length === 0}
          className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50"
        >
          <option value="">— Rolle auswählen —</option>
          {availableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {availableRoles.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            Keine Rollen verfügbar. Zuerst Rollen in der Rollenverwaltung erstellen.
          </p>
        ) : null}
      </div>

      {/* Scope mode (OrgUnit page only) */}
      {showScopeModeSelector ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-2)]">Geltungsbereich</label>
          <div className="space-y-1.5">
            {(
              [
                "THIS_ORG_UNIT",
                "THIS_ORG_UNIT_AND_DESCENDANTS",
              ] as const
            ).map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 hover:bg-[var(--surface-2)]"
              >
                <input
                  type="radio"
                  name="scopeMode"
                  value={mode}
                  checked={scopeMode === mode}
                  onChange={() => setScopeMode(mode)}
                  disabled={isPending}
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">
                  {SCOPE_MODE_LABELS[mode]}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !selectedUser || !roleId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Zuweisen…
            </>
          ) : (
            <>
              <Shield className="h-3.5 w-3.5" />
              Zuweisen
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition disabled:opacity-40"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export default function ScopedResponsibilitiesCard({
  orgUnitId,
  orgUnitName,
  initialAssignments,
  availableRoles,
  eligibleUsers,
  showScopeModeSelector = false,
  canManage,
}: ScopedResponsibilitiesCardProps) {
  const router = useRouter();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const existingUserIds = initialAssignments.map((a) => a.userId);

  function handleAdded() {
    setAddPanelOpen(false);
    router.refresh();
  }

  async function handleRemove(assignment: ScopedAssignment) {
    const label = `${assignment.firstName} ${assignment.lastName} — ${assignment.roleName}`;
    if (!window.confirm(`Zuständigkeit „${label}" wirklich entfernen?`)) return;

    setRemovingId(assignment.id);
    setRemoveError(null);

    try {
      const res = await fetch(
        `/api/org-units/${orgUnitId}/responsibilities/${assignment.id}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveError(data.error ?? "Entfernen fehlgeschlagen.");
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
          <Shield className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Personen &amp; Zuständigkeiten
          </p>
          {initialAssignments.length > 0 ? (
            <span className="sce-count-badge">{initialAssignments.length}</span>
          ) : null}
        </div>
        {canManage ? (
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
                Zuständigkeit hinzufügen
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Scope context badge */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5">
        <p className="text-[11px] text-[var(--muted)]">
          Bereich:{" "}
          <span className="font-semibold text-[var(--foreground)]">{orgUnitName}</span>
        </p>
      </div>

      {/* Add panel */}
      {addPanelOpen && canManage ? (
        <AddPanel
          orgUnitId={orgUnitId}
          eligibleUsers={eligibleUsers}
          availableRoles={availableRoles}
          existingUserIds={existingUserIds}
          showScopeModeSelector={showScopeModeSelector}
          onAdded={handleAdded}
          onCancel={() => setAddPanelOpen(false)}
        />
      ) : null}

      {/* Remove error */}
      {removeError ? (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {removeError}
        </div>
      ) : null}

      {/* Assignment list */}
      {initialAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <Shield className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Noch keine Zuständigkeiten
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {canManage
                ? "Über die Schaltfläche oben Zuständigkeiten zuweisen."
                : "Keine Zuständigkeiten erfasst."}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {initialAssignments.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4">
              <AdminAvatar
                name={`${a.firstName} ${a.lastName}`}
                size="sm"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {a.firstName} {a.lastName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="sce-role-badge sce-role-badge-staff">
                    {a.roleName}
                  </span>
                  {showScopeModeSelector &&
                  a.scopeMode === "THIS_ORG_UNIT_AND_DESCENDANTS" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                      + Unterbereiche
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--muted)]">{a.email}</p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => handleRemove(a)}
                  disabled={removingId === a.id}
                  className="flex-shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  {removingId === a.id ? "Entfernen…" : "Entfernen"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
