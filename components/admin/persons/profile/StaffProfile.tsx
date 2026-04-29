import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { ProfileCard, ProfileShell, formatDate } from "./PersonProfileLayout";

export default function StaffProfile({ person, name, primaryType, typeLabels, roleNames, departments }: { person: any; name: string; primaryType: string; typeLabels: string[]; roleNames: string[]; departments: string[] }) {
  return (
    <ProfileShell person={person} name={name} primaryType={primaryType} typeLabels={typeLabels}>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi icon={<Clock3 className="h-5 w-5" />} label="Offene Aufgaben" value={String(person.vereinsleitungOwnedMatters.length)} />
        <Kpi icon={<ShieldCheck className="h-5 w-5" />} label="Rollen" value={String(roleNames.length)} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Aktiv" value={person.isActive ? "Ja" : "Nein"} highlight />
      </div>

      <ProfileCard eyebrow="Funktionen" title="Kernverantwortlichkeiten">
        <div className="flex flex-wrap gap-2">
          {roleNames.length === 0 ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">Keine Rolle hinterlegt</span> : roleNames.map((role) => <span key={role} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{role}</span>)}
        </div>
        {departments.length ? <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">Bereiche: {departments.join(", ")}</p> : null}
      </ProfileCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard eyebrow="Zugewiesene Aufgaben" title="Pendenzen">
          <div className="space-y-3">
            {person.vereinsleitungOwnedMatters.length === 0 ? <Empty text="Keine offenen Einträge sichtbar." /> : person.vereinsleitungOwnedMatters.map((matter: any) => <div key={matter.title} className="rounded-2xl bg-slate-50 px-4 py-3"><p className="font-bold text-slate-900">{matter.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{matter.status} · {matter.priority} · {formatDate(matter.dueDate)}</p></div>)}
          </div>
        </ProfileCard>
        <ProfileCard eyebrow="Letzte Aktivitäten" title="Meeting-Bezug">
          <div className="space-y-3">
            {person.meetingParticipants.length === 0 ? <Empty text="Keine Meeting-Teilnahmen sichtbar." /> : person.meetingParticipants.map((participant: any) => <div key={`${participant.meeting.title}-${participant.meeting.startAt.toISOString()}`} className="rounded-2xl bg-slate-50 px-4 py-3"><p className="font-bold text-slate-900">{participant.meeting.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(participant.meeting.startAt)} · {participant.status}</p></div>)}
          </div>
        </ProfileCard>
      </div>
    </ProfileShell>
  );
}

function Kpi({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return <div className={"rounded-[26px] border p-5 shadow-sm " + (highlight ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white")}><div className="flex items-center gap-3 text-slate-500">{icon}<span className="text-xs font-black uppercase tracking-[0.14em]">{label}</span></div><p className="mt-3 text-3xl font-black text-slate-950">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{text}</p>;
}
