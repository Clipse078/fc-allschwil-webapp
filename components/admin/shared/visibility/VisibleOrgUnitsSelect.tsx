"use client";

import { useState, useMemo } from "react";
import { Building2, ChevronDown, X } from "lucide-react";

export type OrgUnitOption = {
  id: string;
  key: string;
  name: string;
  type: string;
  level: number;
};

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein", DIVISION: "Abteilung", DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort", TEAM: "Mannschaft", COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe", CUSTOM: "Einheit",
};

type VisibleOrgUnitsSelectProps = {
  selected: string[];        // OrgUnit.id[]
  options: OrgUnitOption[];
  onChange: (ids: string[]) => void;
};

export default function VisibleOrgUnitsSelect({
  selected,
  options,
  onChange,
}: VisibleOrgUnitsSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () =>
      options.filter(
        (o) =>
          !selected.includes(o.id) &&
          (query === "" ||
            o.name.toLowerCase().includes(query.toLowerCase()) ||
            o.key.toLowerCase().includes(query.toLowerCase())),
      ),
    [options, selected, query],
  );

  function addUnit(id: string) {
    onChange([...selected, id]);
    setQuery("");
  }

  function removeUnit(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  const selectedUnits = options.filter((o) => selected.includes(o.id));

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sce-muted)]">
        Organisationseinheiten
      </p>
      <p className="mb-3 text-[11px] text-[var(--sce-subtle)]">
        Alle aktiven Mitglieder dieser Einheiten können diesen Eintrag sehen.
      </p>

      {selectedUnits.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedUnits.map((unit) => (
            <span
              key={unit.id}
              className="sce-chip sce-chip-primary gap-1.5 px-3 py-1 text-[12px]"
            >
              <Building2 className="h-3 w-3 shrink-0" />
              {unit.name}
              <button
                type="button"
                onClick={() => removeUnit(unit.id)}
                aria-label={`${unit.name} entfernen`}
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
          <span>Organisationseinheit hinzufügen…</span>
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
            <ul className="max-h-52 overflow-y-auto pb-2">
              {available.length === 0 ? (
                <li className="px-4 py-3 text-[12px] text-[var(--sce-subtle)] italic">
                  Keine weiteren Einheiten verfügbar
                </li>
              ) : (
                available.map((unit) => (
                  <li key={unit.id}>
                    <button
                      type="button"
                      onClick={() => { addUnit(unit.id); setOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-[var(--sce-subtle)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--sce-heading)]">{unit.name}</p>
                        <p className="truncate text-[10px] text-[var(--sce-muted)]">
                          {TYPE_LABELS[unit.type] ?? unit.type}
                          {unit.level > 0 ? ` · Ebene ${unit.level}` : ""}
                          {" · "}
                          <code className="font-mono">{unit.key}</code>
                        </p>
                      </div>
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
