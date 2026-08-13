import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUsersListData } from "@/lib/users/queries";
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

  let users: Awaited<ReturnType<typeof getTenantUsersListData>> = [];
  try {
    users = await getTenantUsersListData(tenantId);
  } catch {
    users = [];
  }

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Benutzer"
        description="Alle Benutzerkonten mit Zugang zu diesem Club — Status, Rollen und Mitgliedschaft auf einen Blick."
      />
      <TenantUsersSearchableList
        initialUsers={users}
        currentUserId={currentUserId}
      />
    </div>
  );
}
