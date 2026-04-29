import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Mail, Phone, ShieldCheck } from "lucide-react";
import PersonPhotoUploader from "@/components/admin/persons/PersonPhotoUploader";

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Offen";
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function ProfileShell({ person, name, primaryType, typeLabels, children }: { person: any; name: string; primaryType: string; typeLabels: string[]; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="fca-eyebrow">Personenprofil · {primaryType}</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{name}</h1>
        </div>
        <Link href="/dashboard/persons" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50">Zurück zu Personen</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
            <div className="p-6 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[34px] bg-gradient-to-br from-blue-50 to-red-50 text-2xl font-black text-[#0b4aa2] shadow-sm">
                {person.photoUrl ? <img src={person.photoUrl} alt={name} className="h-full w-full object-cover" /> : <>{person.firstName.charAt(0)}{person.lastName.charAt(0)}</>}
              </div>
              <h2 className="mt-4 text-xl font-black text-slate-950">{name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{primaryType}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {typeLabels.map((label) => <span key={label} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">{label}</span>)}
                <span className={"rounded-full border px-3 py-1.5 text-xs font-black " + (person.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>{person.isActive ? "Aktiv" : "Inaktiv"}</span>
              </div>
            </div>
          </section>

          <PersonPhotoUploader personId={person.id} name={name} initialPhotoUrl={person.photoUrl} canEdit={true} />

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Kontaktinformationen</h3>
            <div className="mt-4 space-y-3 text-sm">
              <InfoLine icon={<Mail className="h-4 w-4" />} label="E-Mail" value={person.email ?? "Offen"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Telefon" value={person.phone ?? "Offen"} />
              <InfoLine icon={<CalendarDays className="h-4 w-4" />} label="Geburtsdatum" value={formatDate(person.dateOfBirth)} />
              <InfoLine icon={<ShieldCheck className="h-4 w-4" />} label="Im Verein seit" value={formatDate(person.clubJoinDate)} />
            </div>
          </section>
        </aside>

        <main className="space-y-5">{children}</main>
      </div>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b4aa2] shadow-sm">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-0.5 truncate font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export function ProfileCard({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>{eyebrow ? <p className="fca-eyebrow">{eyebrow}</p> : null}<h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2></div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

