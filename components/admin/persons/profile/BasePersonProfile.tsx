import { ProfileCard, ProfileEmptyState, ProfileShell, CareerTimelinePlaceholder } from "./PersonProfileLayout";

export default function BasePersonProfile({
  person,
  name,
  primaryType,
  typeLabels,
}: {
  person: any;
  name: string;
  primaryType: string;
  typeLabels: string[];
}) {
  return (
    <ProfileShell person={person} name={name} primaryType={primaryType} typeLabels={typeLabels}>
      
      <ProfileCard eyebrow="Allgemein" title="Kontext / Beziehung zum Verein">
        {person.notes ? (
          <p className="text-sm font-semibold text-slate-700">{person.notes}</p>
        ) : (
          <ProfileEmptyState text="Keine zusätzlichen Informationen zur Person hinterlegt." />
        )}
      </ProfileCard>

      <ProfileCard eyebrow="Bemerkungen" title="Interne Notizen">
        <textarea
          className="min-h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none focus:border-blue-300"
          defaultValue={person.notes ?? ""}
          placeholder="Notizen zur Person (z.B. Sponsor-Kontakt, Gemeinde, Partner etc.)..."
        />
      </ProfileCard>

      <CareerTimelinePlaceholder text="Historie dieser Person wird später hier sichtbar: Zusammenarbeit, Rollen, Kontakte und Aktivitäten über die Zeit." />

    </ProfileShell>
  );
}
