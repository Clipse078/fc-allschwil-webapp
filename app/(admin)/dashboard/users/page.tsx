import Link from "next/link";
import { UserPlus } from "lucide-react";
import UsersSearchableList from "@/components/admin/users/UsersSearchableList";
import RoleManagementCard from "@/components/admin/users/RoleManagementCard";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPlatformRolesListData, getUsersListData } from "@/lib/users/queries";

export default async function UsersPage() {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const users = await getUsersListData();
  // RPERM-05-C1: this platform-only card mutates roles through
  // /api/roles/[id] (PLATFORM-scope guarded) — only ever list PLATFORM
  // roles here, never a tenant role a platform admin cannot actually save.
  const roles = await getPlatformRolesListData();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Benutzer & Rollen"
        title="Benutzer"
        description="Alle Benutzerkonten im System — Rollen, Status und Zugriffe auf einen Blick."
        actions={
          <Link href="/dashboard/users/new" className="fca-button-primary">
            <UserPlus className="h-4 w-4" />
            Neuer Benutzer
          </Link>
        }
      />

      <UsersSearchableList currentUserId={currentUserId} initialUsers={users} />

      <RoleManagementCard initialRoles={roles} />
    </div>
  );
}
