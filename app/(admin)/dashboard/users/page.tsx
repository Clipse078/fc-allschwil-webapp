import Link from "next/link";
import UsersTable from "@/components/admin/users/UsersTable";
import RoleManagementCard from "@/components/admin/users/RoleManagementCard";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData, getUsersListData } from "@/lib/users/queries";

export default async function UsersPage() {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const users = await getUsersListData();
  const roles = await getRolesListData();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Benutzer & Rollen"
        title="Benutzer und Rollen"
        description="Admin verwaltet hier Benutzer, Rollen, Rollenbeschreibungen sowie zusätzliche Zugriffe wie Vereinsleitungs-Modul und Meeting-Teilnahme."
        actions={
          <Link href="/dashboard/users/new" className="fca-button-primary">
            Neuer Benutzer
          </Link>
        }
      />

      <UsersTable currentUserId={currentUserId} initialUsers={users} />

      <RoleManagementCard initialRoles={roles} />
    </div>
  );
}
