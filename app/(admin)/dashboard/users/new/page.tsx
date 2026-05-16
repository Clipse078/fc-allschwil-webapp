import UserForm from "@/components/admin/users/UserForm";
import AdminPageIntro from "@/components/admin/shared/AdminPageIntro";
import { requirePermission } from "@/lib/permissions/require-permission";

export default async function NewUserPage() {
  await requirePermission("users.manage");

  return (
    <div className="space-y-8">
      <AdminPageIntro
        eyebrow="Benutzerverwaltung"
        title="Neuer Benutzer"
        description="Lege einen neuen Benutzer für die WebApp an."
      />

      <UserForm mode="create" />
    </div>
  );
}
