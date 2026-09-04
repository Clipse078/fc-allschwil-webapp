import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUsersListData, getTenantPersonsWithoutUser } from "@/lib/users/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantUsersSearchableList from "@/components/admin/users/TenantUsersSearchableList";

export default async function PeopleAccessPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const canInvite = hasPermission(session, PERMISSIONS.USERS_INVITE);
  const canManage =
    hasPermission(session, PERMISSIONS.USERS_MANAGE_MEMBERSHIPS) ||
    hasPermission(session, PERMISSIONS.USERS_MANAGE);
  const canGlobalDelete = hasPermission(session, PERMISSIONS.USERS_DELETE);

  const [users, personsWithoutUser] = await Promise.all([
    getTenantUsersListData(tenantId).catch(() => []),
    getTenantPersonsWithoutUser(tenantId).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Personen & Zugänge"
        description="Wer hat Zugang zu SportClubEvo — Rollen, Bereiche, Einladungen und Status auf einen Blick."
      />
      <TenantUsersSearchableList
        initialUsers={users}
        personsWithoutUser={personsWithoutUser}
        currentUserId={currentUserId}
        canInvite={canInvite}
        canManage={canManage}
        canGlobalDelete={canGlobalDelete}
      />
    </div>
  );
}
