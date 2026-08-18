import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById } from "@/lib/people/queries";
import PersonForm from "@/components/admin/persons/PersonForm";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPersonPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.PEOPLE_MANAGE);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  return (
    <PersonForm
      mode="edit"
      personId={person.id}
      defaultValues={{
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName ?? "",
        email: person.email ?? "",
        phone: person.phone ?? "",
        dateOfBirth: person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
        notes: person.notes ?? "",
        isActive: person.isActive,
        isPlayer: person.isPlayer,
        isTrainer: person.isTrainer,
        isFunctionary: person.isFunctionary,
        isVolunteer: person.isVolunteer,
        isReferee: person.isReferee,
        isSponsorContact: person.isSponsorContact,
        customFunctions: person.customFunctions,
      }}
    />
  );
}
