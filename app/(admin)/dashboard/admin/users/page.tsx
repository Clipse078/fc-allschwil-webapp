import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantUsersListData } from "@/lib/users/queries";
import { getInvitationsForTenant } from "@/lib/invitations/service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantUsersSearchableList from "@/components/admin/users/TenantUsersSearchableList";
import InvitationsPanel from "@/components/admin/invitations/InvitationsPanel";

export default async function AdminUsersPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_INVITE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const currentUserId = session.user.effectiveUserId ?? session.user.id;
  const canInvite = hasPermission(session, PERMISSIONS.USERS_INVITE);

  const [users, invitations] = await Promise.all([
    getTenantUsersListData(tenantId).catch(() => []),
    canInvite ? getInvitationsForTenant(tenantId).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Benutzer"
        description="Aktive Benutzer, ausstehende Einladungen und Zugangsverwaltung auf einen Blick."
      />

      {/* Invitations panel — visible to users with invite permission */}
      {canInvite && (
        <InvitationsPanel
          initialInvitations={invitations}
          canInvite={canInvite}
        />
      )}

      <TenantUsersSearchableList
        initialUsers={users}
        currentUserId={currentUserId}
      />
    </div>
  );
}
