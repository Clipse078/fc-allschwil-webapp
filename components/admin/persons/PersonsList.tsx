"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, UserCircle2 } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type PersonItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roleLabel?: string | null;
  teamLabel?: string | null;
  birthYear?: string | null;
  imageSrc?: string | null;
  isActive?: boolean;
  typeLabels: string[];
  primaryType: string;
  trainerExperienceYears?: number | null;
  clubJoinDate?: string | null;
};

type PersonsListProps = {
  persons: PersonItem[];
};

const FILTERS = ["Alle", "Spieler", "Trainer", "Vereinsfunktionär", "Person"];

export default function PersonsList({ persons }: PersonsListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Alle");

  const filteredPersons = useMemo(() => {
    const safeQuery = query.trim().toLowerCase();

    return persons.filter((person) => {
      const matchesFilter = filter === "Alle" || person.typeLabels.includes(filter);
      const haystack = [
        person.name,
        person.email,
        person.phone,
        person.roleLabel,
        person.teamLabel,
        person.birthYear,
        ...person.typeLabels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!safeQuery || haystack.includes(safeQuery));
    });
  }, [filter, persons, query]);

  const counts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, item) => {
      acc[item] = item === "Alle" ? persons.length : persons.filter((person) => person.typeLabels.includes(item)).length;
      return acc;
    }, {});
  }, [persons]);

  return (
    <div className="space-y-5">
      <AdminSurfaceCard className="overflow-hidden p-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="fca-eyebrow">Zentrale Personenkartei</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Alle Personen</h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-[280px] items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="h-4 w-4 text-[#0b4aa2]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Person suchen..."
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="bg-transparent text-sm font-black text-slate-700 outline-none"
                >
                  {FILTERS.map((item) => (
                    <option key={item} value={item}>
                      {item} ({counts[item] ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </AdminSurfaceCard>

      {filteredPersons.length === 0 ? (
        <AdminSurfaceCard className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-500">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="fca-subheading">Keine Personen gefunden</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Passe Suche oder Filter an.</p>
            </div>
          </div>
        </AdminSurfaceCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredPersons.map((person) => (
            <Link
              key={person.id}
              href={`/dashboard/persons/${person.id}`}
              className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-[0_24px_54px_rgba(11,74,162,0.10)]"
            >
              <div className="h-1 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839] opacity-70" />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <AdminAvatar name={person.name} imageSrc={person.imageSrc} size="lg" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black tracking-tight text-slate-950">{person.name}</h3>
                      <AdminStatusPill label={person.isActive === false ? "Inaktiv" : "Aktiv"} tone={person.isActive === false ? "muted" : "success"} />
                    </div>

                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                      {[person.teamLabel, person.roleLabel, person.email].filter(Boolean).join(" · ") || "Keine Zusatzinformationen hinterlegt"}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {person.typeLabels.map((label) => (
                        <span key={label} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">
                          {label}
                        </span>
                      ))}
                      {person.birthYear ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                          Jahrgang {person.birthYear}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <InfoTile label="Typ" value={person.primaryType} />
                  <InfoTile label="Team/Funktion" value={person.teamLabel ?? person.roleLabel ?? "Offen"} />
                  <InfoTile label="Kontakt" value={person.phone ?? person.email ?? "Offen"} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
