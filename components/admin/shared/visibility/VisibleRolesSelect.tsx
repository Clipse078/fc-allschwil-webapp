"use client";

import { useState, useMemo } from "react";
import { X, ChevronDown } from "lucide-react";

export type RoleOption = { key: string; name: string };

type VisibleRolesSelectProps = {
  selected: string[];
  options: RoleOption[];
  onChange: (keys: string[]) => void;
};

export default function VisibleRolesSelect({
  selected,
  options,
  onChange,
}: VisibleRolesSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () =>
      options.filter(
        (o) =>
          !selected.includes(o.key) &&
          (query === "" || o.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [options, selected, query],
  );

  function addRole(key: string) {
    onChange([...selected, key]);
    setQuery("");
  }

  function removeRole(key: string) {
    onChange(selected.filter((k) => k !== key));
  }

  const selectedRoles = options.filter((o) => selected.includes(o.key));

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sce-muted)]">
        Erlaubte Rollen
      </p>
      <p className="mb-3 text-[11px] text-[var(--sce-subtle)]">
        Mitglieder dieser Rollen können diesen Eintrag sehen.
      </p>

      {selectedRoles.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedRoles.map((role) => (
            <span
              key={role.key}
              className="sce-chip sce-chip-primary gap-1.5 px-3 py-1 text-[12px]"
            >
              {role.name}
              <button
                type="button"
                onClick={() => removeRole(role.key)}
                aria-label={`${role.name} entfernen`}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[var(--sce-primary-soft)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[14px] border border-[var(--sce-border)] bg-[var(--sce-surface-strong)] px-4 py-2.5 text-sm text-[var(--sce-muted)] hover:border-[var(--sce-border-strong)]"
        >
          <span>Rolle hinzufügen…</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-[16px] border border-[var(--sce-border)] bg-[var(--sce-surface-strong)] shadow-[var(--sce-shadow-soft)]">
            <div className="p-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Suchen…"
                autoFocus
                className="sce-form-field rounded-[10px] px-3 py-2"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto pb-2">
              {available.length === 0 ? (
                <li className="px-4 py-3 text-[12px] text-[var(--sce-subtle)] italic">
                  Keine weiteren Rollen verfügbar
                </li>
              ) : (
                available.map((role) => (
                  <li key={role.key}>
                    <button
                      type="button"
                      onClick={() => { addRole(role.key); setOpen(false); }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm text-[var(--sce-heading)] hover:bg-slate-50"
                    >
                      {role.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
