import { ProfileCard, ProfileShell } from "./PersonProfileLayout";
import type { ReactNode } from "react";

export default function PlayerProfile({ person, name, primaryType, typeLabels, ratings }: { person: any; name: string; primaryType: string; typeLabels: string[]; ratings: ReactNode }) {
  return (
    <ProfileShell person={person} name={name} primaryType={primaryType} typeLabels={typeLabels}>
      <ProfileCard eyebrow="Spielerprofil" title="Teamzuordnung">
        <div className="grid gap-3">
          {person.playerSquadMembers.length === 0 ? <Empty text="Noch keinem Team zugeordnet." /> : person.playerSquadMembers.map((assignment: any) => {
            const teamName = assignment.teamSeason.shortName ?? assignment.teamSeason.displayName ?? assignment.teamSeason.team.name;
            return <div key={teamName} className="rounded-[24px] border border-emerald-100 bg-emerald-50/50 p-4"><p className="font-black text-slate-900">{teamName}</p><p className="mt-1 text-sm font-semibold text-slate-500">{assignment.positionLabel ?? "Position offen"} · {assignment.teamSeason.season.name}</p></div>;
          })}
        </div>
      </ProfileCard>
      <ProfileCard eyebrow="Trainernotizen" title="Interne Notizen">
        <textarea className="min-h-40 w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none focus:border-blue-300" placeholder="Notizen, Beobachtungen oder Feedback zum Spieler..." defaultValue={person.notes ?? ""} />
      </ProfileCard>
      {ratings}
    </ProfileShell>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{text}</p>;
}

