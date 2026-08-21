"use client";

/**
 * WaitingListCoordinatorPicker — REG-WAIT-01D / REG-WAIT-01E
 *
 * Person-oriented coordinator selection constrained to eligible registration
 * coordinators (users with effective registrations.edit in the tenant).
 * Reuses the established inline user-search UX from ScopedResponsibilitiesCard.
 *
 * Exports:
 *   WaitingListCoordinatorPicker  — searchable full picker (create/edit)
 *   WaitingListResponsibleDisplay — read-only avatar + name
 *   CoordinatorFilterBar          — compact pill-based coordinator filter
 *   WaitingListCoordinatorFilter  — legacy <select> (preserved, not used in normal UX)
 */

import { useId, useMemo, useState } from "react";
import { UserCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AssignableUser } from "@/lib/registrations/workflow-types";
import { getPersonInitials } from "@/lib/registrations/waiting-list-ui";

// ── Avatar ────────────────────────────────────────────────────────────────────

export function CoordinatorAvatar({ name, compact }: { name: string; compact?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 font-bold uppercase tracking-wide text-[var(--blue)]",
        compact ? "h-6 w-6 text-[0.55rem]" : "h-8 w-8 text-[0.65rem]",
      )}
    >
      {getPersonInitials(name) || "?"}
    </div>
  );
}

// ── Searchable full picker ────────────────────────────────────────────────────

type PickerProps = {
  eligibleCoordinators: AssignableUser[];
  selectedUserId?: string | null;
  onSelect: (userId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
};

export function WaitingListCoordinatorPicker({
  eligibleCoordinators,
  selectedUserId = null,
  onSelect,
  disabled = false,
  placeholder = "Koordinator suchen…",
  compact = false,
}: PickerProps) {
  const instanceId = useId();
  const listboxId = `wl-coordinator-listbox-${instanceId}`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => eligibleCoordinators.find((user) => user.id === selectedUserId) ?? null,
    [eligibleCoordinators, selectedUserId],
  );

  const filtered = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return eligibleCoordinators
      .filter((user) => {
        const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [eligibleCoordinators, query]);

  const selectedLabel = selected ? `${selected.firstName} ${selected.lastName}` : null;

  return (
    <div className="relative w-full">
      {selected ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-2)]",
            compact ? "px-2.5 py-2" : "px-3 py-2.5",
          )}
        >
          <CoordinatorAvatar name={selectedLabel ?? "?"} compact={compact} />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-semibold text-[var(--foreground)]", compact ? "text-xs" : "text-sm")}>
              {selectedLabel}
            </p>
            {!compact && selected.email ? (
              <p className="truncate text-xs text-[var(--muted)]">{selected.email}</p>
            ) : null}
          </div>
          {!disabled ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-slate-200 hover:text-[var(--foreground)]"
              aria-label="Koordinator entfernen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)]",
            compact ? "px-2.5 py-1.5" : "px-3 py-2",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <UserCheck className={cn("flex-shrink-0 text-[var(--muted)]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={cn(
              "flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none",
              compact ? "text-xs" : "text-sm",
            )}
            aria-label={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && filtered.length > 0}
            aria-controls={listboxId}
            aria-haspopup="listbox"
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
              aria-label="Suche leeren"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}

      {!selected && query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">Mindestens 2 Zeichen eingeben.</p>
      ) : null}

      {!selected && !open && query.trim().length >= 2 && filtered.length === 0 ? (
        <p className="mt-1 text-xs italic text-[var(--muted)]">Keine berechtigten Koordinatoren gefunden.</p>
      ) : null}

      {open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
        >
          {filtered.map((user) => {
            const label = `${user.firstName} ${user.lastName}`;
            return (
              <li key={user.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(user.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <CoordinatorAvatar name={label} compact />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{label}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ── Read-only responsible display ─────────────────────────────────────────────

export function WaitingListResponsibleDisplay({
  firstName,
  lastName,
  email,
  compact = false,
}: {
  firstName: string;
  lastName: string;
  email?: string | null;
  compact?: boolean;
}) {
  const label = `${firstName} ${lastName}`;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <CoordinatorAvatar name={label} compact={compact} />
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-[var(--foreground)]", compact ? "text-xs" : "text-sm")}>
          {label}
        </p>
        {!compact && email ? (
          <p className="truncate text-[0.68rem] text-[var(--muted)]">{email}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Compact pill-based coordinator filter ─────────────────────────────────────
// Replaces the legacy fca-select for filtering by responsible coordinator.

type FilterBarProps = {
  eligibleCoordinators: AssignableUser[];
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string | null;
};

export function CoordinatorFilterBar({ eligibleCoordinators, value, onChange, currentUserId }: FilterBarProps) {
  const instanceId = useId();
  const listboxId = `coord-filter-listbox-${instanceId}`;
  const [open, setOpen] = useState(false);

  const selectedUser = eligibleCoordinators.find((u) => u.id === value) ?? null;
  const isMe = value === currentUserId && !!currentUserId;

  const displayLabel = isMe
    ? "Mir zugewiesen"
    : selectedUser
      ? `${selectedUser.firstName} ${selectedUser.lastName}`
      : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          value
            ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
            : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Koordinator filtern"
      >
        <UserCheck className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <span className="max-w-[120px] truncate">
          {displayLabel ?? "Koordinator"}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); } }}
            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full hover:bg-[var(--tenant-primary)]/20"
            aria-label="Filter entfernen"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
        >
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              onMouseDown={() => { onChange(""); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                !value && "bg-[var(--surface-2)] font-semibold",
              )}
            >
              Alle Koordinatoren
            </button>
          </li>
          {currentUserId ? (
            <li role="option" aria-selected={value === currentUserId}>
              <button
                type="button"
                onMouseDown={() => { onChange(currentUserId); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                  value === currentUserId && "bg-[var(--surface-2)] font-semibold",
                )}
              >
                <CoordinatorAvatar name="Ich" compact />
                Mir zugewiesen
              </button>
            </li>
          ) : null}
          {eligibleCoordinators
            .filter((u) => u.id !== currentUserId)
            .map((user) => {
              const label = `${user.firstName} ${user.lastName}`;
              return (
                <li key={user.id} role="option" aria-selected={value === user.id}>
                  <button
                    type="button"
                    onMouseDown={() => { onChange(user.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-2)]",
                      value === user.id && "bg-[var(--surface-2)] font-semibold",
                    )}
                  >
                    <CoordinatorAvatar name={label} compact />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      ) : null}
    </div>
  );
}

// ── Legacy <select> filter — preserved but not used in main UX ────────────────

export function WaitingListCoordinatorFilter({
  eligibleCoordinators,
  value,
  onChange,
  currentUserId,
}: {
  eligibleCoordinators: AssignableUser[];
  value: string;
  onChange: (value: string) => void;
  currentUserId?: string | null;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fca-select h-8 min-w-[160px] text-xs"
      aria-label="Koordinator filtern"
    >
      <option value="">Alle Koordinatoren</option>
      {currentUserId ? <option value={currentUserId}>Mir zugewiesen</option> : null}
      {eligibleCoordinators
        .filter((user) => user.id !== currentUserId)
        .map((user) => (
          <option key={user.id} value={user.id}>
            {user.firstName} {user.lastName}
          </option>
        ))}
    </select>
  );
}
