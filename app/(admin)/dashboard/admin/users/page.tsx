import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUsersListData, getTenantPersonsWithoutUser } from "@/lib/users/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantUsersSearchableList from "@/components/admin/users/TenantUsersSearchableList";

export default async function AdminUsersPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const canInvite = hasPermission(session, PERMISSIONS.USERS_INVITE);

  const [users, personsWithoutUser] = await Promise.all([
    getTenantUsersListData(tenantId).catch(() => []),
    getTenantPersonsWithoutUser(tenantId).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Benutzer"
        description="Alle Benutzerkonten und Personen in diesem Club — Status, Rollen, Einladungen und Bereichszuständigkeiten."
      />
      <TenantUsersSearchableList
        initialUsers={users}
        personsWithoutUser={personsWithoutUser}
        currentUserId={currentUserId}
        canInvite={canInvite}
      />
    </div>
  );
}
