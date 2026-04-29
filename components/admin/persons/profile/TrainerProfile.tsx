import { Award, BadgeCheck, CalendarDays } from "lucide-react";
import { ProfileCard, ProfileShell, formatDate } from "./PersonProfileLayout";
import type { ReactNode } from "react";

export default function TrainerProfile({ person, name, primaryType, typeLabels, qualificationsEditor }: { person: any; name: string; primaryType: string; typeLabels: string[]; qualificationsEditor: ReactNode }) {
  return (
    <ProfileShell person={person} name={name} primaryType={primaryType} typeLabels={typeLabels}>
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard eyebrow="Zertifizierungen & Lizenzen" title="Qualifikationen" action={<span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-[#0b4aa2]">{person.trainerExperienceYears ?? 0} Jahre Erfahrung</span>}>
          <div className="grid gap-3">
            {person.trainerQualifications.length === 0 ? <Empty text="Noch keine Qualifikationen hinterlegt." /> : person.trainerQualifications.map((q: any) => (
              <div key={q.id} className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-black text-slate-900">{q.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{q.type} · {q.status} · {q.issuer ?? "Aussteller offen"}</p><p className="mt-1 text-xs font-semibold text-slate-400">Gültig bis: {formatDate(q.expiresAt)}</p></div>
                  {q.isClubVerified ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <Award className="h-5 w-5 text-slate-300" />}
                </div>
              </div>
            ))}
          </div>
        </ProfileCard>

        <ProfileCard eyebrow="Betreute Teams" title="Teamzuordnungen">
          <div className="space-y-3">
            {person.trainerTeamMembers.length === 0 ? <Empty text="Noch keinem Team zugeordnet." /> : person.trainerTeamMembers.map((assignment: any) => {
              const teamName = assignment.teamSeason.shortName ?? assignment.teamSeason.displayName ?? assignment.teamSeason.team.name;
              return <div key={`${teamName}-${assignment.roleLabel}`} className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-4"><p className="font-black text-slate-900">{teamName}</p><p className="mt-1 text-xs font-semibold text-slate-500">{assignment.roleLabel ?? "Trainer"} · {assignment.teamSeason.season.name}</p></div>;
            })}
          </div>
        </ProfileCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <ProfileCard eyebrow="Wochenplan" title="Auszug">
          <div className="space-y-3 text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"><CalendarDays className="h-4 w-4 text-[#0b4aa2]" />Trainings und Spiele werden später aus dem Wochenplan geladen.</div>
          </div>
        </ProfileCard>
        <ProfileCard eyebrow="Interne Notizen" title="Bemerkungen">
          <textarea className="min-h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none focus:border-blue-300" defaultValue={person.notes ?? ""} placeholder="Interne Trainer-Notizen..." />
        </ProfileCard>
      </div>

      {qualificationsEditor}
    </ProfileShell>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{text}</p>;
}

