import RegistrationProfileWrapper from "@/components/admin/registrations/RegistrationProfileWrapper";

export default function RegistrationDetailPage() {
  const mockPerson = {
    firstName: "Max",
    lastName: "Mustermann",
    isPlayer: true,
    isTrainer: false,
    isActive: true,
    playerSquadMembers: [],
    trainerTeamMembers: [],
    trainerQualifications: [],
  };

  const name = mockPerson.firstName + " " + mockPerson.lastName;
  const primaryType = "Spieler";
  const typeLabels = ["Spieler"];

  return (
    <RegistrationProfileWrapper
      person={mockPerson}
      name={name}
      primaryType={primaryType}
      typeLabels={typeLabels}
    />
  );
}
