"use client";

import Link from "next/link";
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
  if (persons.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <div className="space-y-3">
          <p className="fca-subheading">Noch keine Personen</p>
          <p className="text-sm leading-6 text-slate-600">
            Noch keine Personen erfasst. Über die Schaltfläche oben rechts den ersten Datensatz anlegen.
          </p>
        </div>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {persons.map((person) => (
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
          subtitle={person.email ?? person.phone ?? "Keine Kontaktdaten hinterlegt"}
          meta={
            <>
              {person.roleLabel ? (
                <span className="fca-pill">{person.roleLabel}</span>
              ) : null}

              <AdminStatusPill
                label={person.isActive === false ? "Inaktiv" : "Aktiv"}
                tone={person.isActive === false ? "muted" : "success"}
              />
            </>
          }
          actions={
            <Link
              href={`/dashboard/persons/${person.id}/edit`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Bearbeiten
            </Link>
          }
        />
      ))}
    </div>
  );
}
