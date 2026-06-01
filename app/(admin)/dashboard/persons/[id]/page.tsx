import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById } from "@/lib/people/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";

type PageProps = { params: Promise<{ id: string }> };

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">
        {value ?? <span className="font-normal italic text-slate-400">—</span>}
      </dd>
    </div>
  );
}

export default async function PersonDetailPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  const fullName =
    person.displayName || `${person.firstName} ${person.lastName}`;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Personen"
        title={fullName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/persons/${person.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#08357a]"
            >
              <Pencil className="h-4 w-4" />
              Bearbeiten
            </Link>
            <Link
              href="/dashboard/persons"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Stammdaten */}
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Stammdaten
            </h3>
            <dl className="space-y-4 text-sm">
              <DetailRow label="Vorname" value={person.firstName} />
              <DetailRow label="Nachname" value={person.lastName} />
              <DetailRow
                label="Anzeigename"
                value={person.displayName ?? null}
              />
              <DetailRow
                label="Geburtsdatum"
                value={
                  person.dateOfBirth ? formatDate(person.dateOfBirth) : null
                }
              />
            </dl>
          </section>

          {/* Notizen */}
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Notizen
            </h3>
            {person.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {person.notes}
              </p>
            ) : (
              <p className="text-[12px] italic text-slate-400">
                Keine Notizen hinterlegt.
              </p>
            )}
          </section>
        </div>

        {/* Aside */}
        <div className="space-y-5">
          {/* Kontakt */}
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Kontakt
            </h3>
            <dl className="space-y-4 text-sm">
              <DetailRow label="E-Mail" value={person.email ?? null} />
              <DetailRow label="Telefon" value={person.phone ?? null} />
            </dl>
          </section>

          {/* Rollen & Status */}
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rollen & Status
            </h3>
            <div className="flex flex-wrap gap-2">
              <AdminStatusPill
                label={person.isActive ? "Aktiv" : "Inaktiv"}
                tone={person.isActive ? "success" : "muted"}
              />
              {person.isPlayer ? (
                <AdminStatusPill label="Spieler" tone="default" />
              ) : null}
              {person.isTrainer ? (
                <AdminStatusPill label="Trainer" tone="default" />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
