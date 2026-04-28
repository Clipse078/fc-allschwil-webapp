"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Filter, Search, UserRound } from "lucide-react";

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
  trainerExperienceYears?: number | null;
  clubJoinDate?: string | null;
  typeLabels?: string[];
  primaryType?: string;
  imageSrc?: string | null;
  isActive?: boolean;
};

type PersonsListProps = {
  persons: PersonItem[];
};

const FILTERS = ["Alle", "Spieler", "Trainer", "Vereinsfunktionär", "Person"] as const;

function getTypeTone(type?: string) {
  if (type === "Trainer") return "border-blue-200 bg-blue-50 text-[#0b4aa2]";
  if (type === "Spieler") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "Vereinsfunktionär") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function PersonsList({ persons }: PersonsListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("Alle");

  const counts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, filter) => {
      acc[filter] =
        filter === "Alle"
          ? persons.length
          : persons.filter((person) => person.typeLabels?.includes(filter)).length;
      return acc;
    }, {});
  }, [persons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return persons.filter((person) => {
      const matchesFilter =
        activeFilter === "Alle" || person.typeLabels?.includes(activeFilter);

      const searchable = [
        person.name,
        person.email,
        person.phone,
        person.roleLabel,
        person.teamLabel,
        person.primaryType,
        ...(person.typeLabels ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!q || searchable.includes(q));
    });
  }, [persons, search, activeFilter]);

  if (persons.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="fca-subheading">Noch keine Personen</p>
        <p className="mt-2 text-sm text-slate-600">
          Die zentrale Personenstruktur ist vorbereitet.
        </p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        {FILTERS.slice(1).map((filter) => (
          <div key={filter} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{filter}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{counts[filter] ?? 0}</p>
          </div>
        ))}
        <div className="rounded-[26px] border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b4aa2]">Total</p>
          <p className="mt-2 text-3xl font-black text-[#0b4aa2]">{persons.length}</p>
        </div>
      </section>

      <AdminSurfaceCard className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-[#0b4aa2]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Person, Rolle, Team oder Kontakt suchen..."
              className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={
                  "rounded-full border px-3 py-2 text-xs font-black transition " +
                  (activeFilter === filter
                    ? "border-blue-200 bg-blue-50 text-[#0b4aa2]"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
                }
              >
                {filter} {counts[filter] ?? 0}
              </button>
            ))}
          </div>
        </div>
      </AdminSurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((person) => (
          <article
            key={person.id}
            className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
          >
            <div className="h-1.5 bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-5">
              <div className="flex items-start gap-4">
                <AdminAvatar name={person.name} imageSrc={person.imageSrc} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-black text-slate-950">{person.name}</h3>
                    <span className={"rounded-full border px-2.5 py-1 text-[11px] font-black " + getTypeTone(person.primaryType)}>
                      {person.primaryType ?? "Person"}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                    {person.teamLabel ?? person.roleLabel ?? person.email ?? "Noch keine Zuordnung"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(person.typeLabels ?? []).map((label) => (
                      <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {label}
                      </span>
                    ))}

                    {person.birthYear ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        Jg. {person.birthYear}
                      </span>
                    ) : null}

                    <AdminStatusPill
                      label={person.isActive === false ? "Inaktiv" : "Aktiv"}
                      tone={person.isActive === false ? "muted" : "success"}
                    />
                  </div>
                </div>

                <UserRound className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-[#0b4aa2]" />
              </div>

              <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Kontakt</p>
                  <p className="mt-1 truncate">{person.email ?? person.phone ?? "Offen"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Rolle / Team</p>
                  <p className="mt-1 truncate">{person.roleLabel ?? person.teamLabel ?? "Offen"}</p>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Link
                  href={`/dashboard/persons/${person.id}`}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600 transition hover:bg-red-50"
                >
                  Profil öffnen
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 ? (
        <AdminSurfaceCard className="p-6">
          <p className="text-sm font-semibold text-slate-500">Keine Personen für diesen Filter gefunden.</p>
        </AdminSurfaceCard>
      ) : null}
    </div>
  );
}
