"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, UserX, ChevronRight } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import PersonRoleBadge from "@/components/admin/shared/PersonRoleBadge";
import { EmptyState } from "@/components/ui/page";

type PersonItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isPlayer?: boolean;
  isTrainer?: boolean;
};

type PersonSearchableListProps = {
  persons: PersonItem[];
};

function getAssignmentLabel(person: PersonItem) {
  const roles: string[] = [];
  if (person.isPlayer) roles.push("Spieler");
  if (person.isTrainer) roles.push("Trainer");
  return roles.length > 0 ? roles.join(" / ") : null;
}

function EmptySearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      icon={<Search className="h-10 w-10" />}
      heading="Keine Treffer"
      description={`Für „${query}" wurden keine Personen gefunden.`}
      action={
        <button
          type="button"
          onClick={onClear}
          className="fca-button-secondary"
        >
          Suche zurücksetzen
        </button>
      }
    />
  );
}

function EmptyPersons() {
  return (
    <EmptyState
      icon={<UserX className="h-10 w-10" />}
      heading="Noch keine Personen"
      description="Erfasse Mitglieder, Spieler und Trainer im Verein. Alle Personen werden hier zentral verwaltet."
      action={
        <Link href="/dashboard/persons/new" className="fca-button-primary">
          <Plus className="h-4 w-4" />
          Erste Person anlegen
        </Link>
      }
    />
  );
}

export default function PersonSearchableList({
  persons,
}: PersonSearchableListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
    );
  }, [persons, query]);

  const playerCount = persons.filter((p) => p.isPlayer).length;
  const trainerCount = persons.filter((p) => p.isTrainer).length;
  const activeCount = persons.filter((p) => p.isActive !== false).length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Gesamt</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "var(--font-display)" }}>
            {persons.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Personen</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktiv</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600" style={{ fontFamily: "var(--font-display)" }}>
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Einträge</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Rollen</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--blue)]" style={{ fontFamily: "var(--font-display)" }}>
            {playerCount + trainerCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {playerCount} Spieler · {trainerCount} Trainer
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Suche nach Name, E-Mail oder Telefon…"
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

      {/* Result count when filtering */}
      {query.trim() ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {persons.length} Personen
        </p>
      ) : null}

      {/* List */}
      {persons.length === 0 ? (
        <EmptyPersons />
      ) : filtered.length === 0 ? (
        <EmptySearch query={query} onClear={() => setQuery("")} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {filtered.map((person, idx) => {
            const assignmentLabel = getAssignmentLabel(person);
            const isLast = idx === filtered.length - 1;

            return (
              <Link
                key={person.id}
                href={`/dashboard/persons/${person.id}`}
                className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)] ${!isLast ? "border-b border-[var(--border)]" : ""}`}
              >
                {/* Avatar */}
                <AdminAvatar name={person.name} size="sm" />

                {/* Name + subtitle */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {person.name}
                    </span>
                    {!person.isPlayer && !person.isTrainer ? (
                      <span className="sce-role-badge sce-role-badge-member">
                        Mitglied
                      </span>
                    ) : null}
                    <PersonRoleBadge
                      isPlayer={person.isPlayer}
                      isTrainer={person.isTrainer}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                    {person.email ?? person.phone ?? "Keine Kontaktdaten"}
                    {assignmentLabel ? (
                      <span className="ml-2 text-[var(--muted)]">
                        · {assignmentLabel}
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Status + chevron */}
                <div className="flex flex-shrink-0 items-center gap-3">
                  <AdminStatusPill
                    label={person.isActive === false ? "Inaktiv" : "Aktiv"}
                    tone={person.isActive === false ? "muted" : "success"}
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
