import Image from "next/image";
import { Building2, Network, ShieldCheck, UserRound } from "lucide-react";
import {
  ORGANIGRAMM_AREAS,
  type OrganigrammArea,
  type OrganigrammRole,
} from "@/lib/vereinsleitung/organigramm-data";

function getAccentClasses(accent: OrganigrammArea["accent"]) {
  switch (accent) {
    case "red":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        glow: "from-rose-50 via-white to-white",
        dot: "bg-rose-500",
      };
    case "blue":
      return {
        badge: "border-blue-200 bg-blue-50 text-blue-700",
        glow: "from-blue-50 via-white to-white",
        dot: "bg-blue-500",
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        glow: "from-slate-50 via-white to-white",
        dot: "bg-slate-500",
      };
  }
}

function getInitials(value: string) {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "NA";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function PersonCard({
  role,
  accent,
}: {
  role: OrganigrammRole;
  accent: OrganigrammArea["accent"];
}) {
  const styles = getAccentClasses(accent);

  return (
    <article className={`rounded-[28px] border border-slate-200/80 bg-gradient-to-br ${styles.glow} p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]`}>
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {role.imageSrc ? (
            <Image
              src={role.imageSrc}
              alt={role.personName}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-sm font-semibold text-slate-600">
              {getInitials(role.personName)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${styles.badge}`}>
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            {role.title}
          </span>

          <h3 className="mt-3 text-[1.02rem] font-semibold tracking-tight text-slate-900">
            {role.personName}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {role.subtitle ?? "Rolle innerhalb des Organigramms"}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function VereinsleitungOrganigrammBoard() {
  const totalRoles = ORGANIGRAMM_AREAS.reduce(
    (sum, area) => sum + area.roles.length,
    0,
  );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-6 md:p-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.85fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                Organisationsstruktur
              </p>
              <h2 className="mt-2 text-[1.55rem] font-semibold tracking-tight text-slate-900">
                FCA Organigramm
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Premium-Visualisierung der Vereinsstruktur mit Bereichen, Rollen, Personen und
                späteren Foto-Zuweisungen. Die Basis ist vorbereitet für die finale FCA-Struktur
                aus deinem Organigramm-Dokument.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Network className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    Bereiche
                  </span>
                </div>
                <div className="mt-3 text-[1.7rem] font-semibold tracking-tight text-slate-900">
                  {ORGANIGRAMM_AREAS.length}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <UserRound className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    Positionen
                  </span>
                </div>
                <div className="mt-3 text-[1.7rem] font-semibold tracking-tight text-slate-900">
                  {totalRoles}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    Struktur
                  </span>
                </div>
                <div className="mt-3 text-[1.05rem] font-semibold text-slate-900">
                  FCA Premium
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {ORGANIGRAMM_AREAS.map((area) => {
        const styles = getAccentClasses(area.accent);

        return (
          <section
            key={area.id}
            className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-6 md:p-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${styles.badge}`}>
                    <Building2 className="h-3.5 w-3.5" />
                    Bereich
                  </span>
                  <h3 className="mt-3 text-[1.35rem] font-semibold tracking-tight text-slate-900">
                    {area.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    {area.description}
                  </p>
                </div>

                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {area.roles.length} Positionen
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {area.roles.map((role) => (
                  <PersonCard key={role.id} role={role} accent={area.accent} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
