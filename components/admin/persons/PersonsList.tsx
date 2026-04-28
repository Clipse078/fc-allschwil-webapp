"use client";

import { useMemo, useState } from "react";

import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type PersonItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roleLabel?: string | null;
  imageSrc?: string | null;
  isActive?: boolean;
};

type PersonsListProps = {
  persons: PersonItem[];
};

export default function PersonsList({ persons }: PersonsListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return persons.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.phone ?? "").toLowerCase().includes(q)
    );
  }, [persons, search]);

  if (persons.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="fca-subheading">Noch keine Personen</p>
        <p className="text-sm text-slate-600 mt-2">
          Als Nächstes verbinden wir hier die echte Datenquelle.
        </p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Person suchen..."
          className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/20"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((person) => (
          <AdminListItem
            key={person.id}
            avatar={
              <AdminAvatar
                name={person.name}
                imageSrc={person.imageSrc}
                size="md"
              />
            }
            title={person.name}
            subtitle={person.email ?? person.phone ?? "Keine Kontaktdaten"}
            meta={
              <>
                {person.roleLabel && (
                  <span className="fca-pill">{person.roleLabel}</span>
                )}

                <AdminStatusPill
                  label={person.isActive === false ? "Inaktiv" : "Aktiv"}
                  tone={person.isActive === false ? "muted" : "success"}
                />
              </>
            }
            actions={
              <a
                href={`/dashboard/persons/${person.id}`}
                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Profil
              </a>
            }
          />
        ))}
      </div>
    </div>
  );
}
