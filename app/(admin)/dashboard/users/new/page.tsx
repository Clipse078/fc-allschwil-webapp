import UserForm from "@/components/admin/users/UserForm";
import { PageHeader, PageShell } from "@/components/shared/page";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData } from "@/lib/users/queries";

export default async function NewUserPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const roles = await getRolesListData();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Benutzerverwaltung"
        title="Neuer Benutzer"
        description="Lege einen neuen Benutzer an, weise direkt mindestens eine Rolle zu und sende danach die Einladung."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Benutzer", href: "/dashboard/users" },
          { label: "Neu" },
        ]}
      />

      <UserForm mode="create" initialRoles={roles} />
    </PageShell>
  );
}
