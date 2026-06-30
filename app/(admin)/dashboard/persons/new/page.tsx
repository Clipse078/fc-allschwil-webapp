import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import PersonForm from "@/components/admin/persons/PersonForm";

export default async function NewPersonPage() {
  await requirePermission(PERMISSIONS.PEOPLE_MANAGE);

  return <PersonForm mode="create" />;
}
