import BasePersonProfile from "@/components/admin/persons/profile/BasePersonProfile";
import PlayerProfile from "@/components/admin/persons/profile/PlayerProfile";
import TrainerProfile from "@/components/admin/persons/profile/TrainerProfile";
import StaffProfile from "@/components/admin/persons/profile/StaffProfile";

export default function RegistrationProfileWrapper({
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
  const statusBadge = (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
      Neu eingegangen
    </span>
  );

  const actions = (
    <div className="flex gap-2">
      <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
        Freigeben
      </button>
      <button className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
        Ablehnen
      </button>
    </div>
  );

  const Header = () => (
    <div className="flex items-center justify-between">
      {statusBadge}
      {actions}
    </div>
  );

  if (person.isPlayer) {
    return (
      <div className="space-y-4">
        <Header />
        <PlayerProfile person={person} name={name} primaryType={primaryType} typeLabels={typeLabels} ratings={null} />
      </div>
    );
  }

  if (person.isTrainer) {
    return (
      <div className="space-y-4">
        <Header />
        <TrainerProfile person={person} name={name} primaryType={primaryType} typeLabels={typeLabels} qualificationsEditor={null} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header />
      <StaffProfile person={person} name={name} primaryType={primaryType} typeLabels={typeLabels} roleNames={[]} departments={[]} />
    </div>
  );
}
