import Link from "next/link";
import UsersTable from "@/components/admin/users/UsersTable";
import RoleManagementCard from "@/components/admin/users/RoleManagementCard";
import { PageHeader, PageShell } from "@/components/shared/page";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData, getUsersListData } from "@/lib/users/queries";

export default async function UsersPage() {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const users = await getUsersListData();
  const roles = await getRolesListData();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Benutzer & Rollen"
        title="Benutzer und Rollen"
        description="Admin verwaltet hier Benutzer, Rollen, Rollenbeschreibungen sowie zusätzliche Zugriffe wie Vereinsleitungs-Modul und Meeting-Teilnahme."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Benutzer" },
        ]}
        actions={
          <Link href="/dashboard/users/new" className="fca-button-primary">
            Neuer Benutzer
          </Link>
        }
      />

      <UsersTable currentUserId={currentUserId} initialUsers={users} />

      <RoleManagementCard initialRoles={roles} />
    </PageShell>
  );
}
