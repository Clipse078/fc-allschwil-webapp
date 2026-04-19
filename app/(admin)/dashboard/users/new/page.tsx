import UserForm from "@/components/admin/users/UserForm";
import AdminPageIntro from "@/components/admin/shared/AdminPageIntro";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData } from "@/lib/users/queries";

export default async function NewUserPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const roles = await getRolesListData();

  return (
    <div className="space-y-8">
      <AdminPageIntro
        eyebrow="Benutzerverwaltung"
        title="Neuer Benutzer"
        description="Lege einen neuen Benutzer an, weise direkt mindestens eine Rolle zu und sende danach die Einladung."
      />

      <UserForm mode="create" initialRoles={roles} />
    </div>
  );
}