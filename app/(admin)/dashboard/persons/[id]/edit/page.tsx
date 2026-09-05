import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonByIdForTenant } from "@/lib/people/queries";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import PersonForm from "@/components/admin/persons/PersonForm";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPersonPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.PEOPLE_MANAGE);
  const tenantId = await requireActiveTenantId();

  const { id } = await params;
  const person = await getPersonByIdForTenant(id, tenantId);
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
