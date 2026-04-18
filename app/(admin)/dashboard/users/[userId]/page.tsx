import Link from "next/link";
import { notFound } from "next/navigation";
import UserForm from "@/components/admin/users/UserForm";
import UserRolesForm from "@/components/admin/users/UserRolesForm";
import ResetPasswordForm from "@/components/admin/users/ResetPasswordForm";
import DeleteUserButton from "@/components/admin/users/DeleteUserButton";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesListData, getUserDetailData } from "@/lib/users/queries";

type UserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const canImpersonate = hasPermission(session, PERMISSIONS.USERS_IMPERSONATE);

  const { userId } = await params;
  const user = await getUserDetailData(userId);

  if (!user) {
    notFound();
  }

  const roles = await getRolesListData();
  const initialRoleIds = user.userRoles.map((userRole) => userRole.role.id);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Benutzerverwaltung"
        title="Benutzer bearbeiten"
        description="Verwalte Stammdaten, Rollen, Status und Passwort dieses Benutzers."
        actions={
          <>
            <Link href="/dashboard/users" className="fca-button-secondary">
              Zurück zu Benutzer
            </Link>
            <DeleteUserButton userId={user.id} isActive={user.isActive} />
          </>
        }
      />

      <UserForm
        mode="edit"
        userId={user.id}
        initialValues={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
        }}
      />

      <UserRolesForm
        userId={user.id}
        initialRoles={roles}
        initialSelectedRoleIds={initialRoleIds}
      />

      <ResetPasswordForm userId={user.id} />

      {canImpersonate ? (
        <AdminSurfaceCard className="p-6">
          <p className="text-sm text-slate-600">
            Impersonation kann weiterhin über die Benutzerliste gestartet werden.
          </p>
        </AdminSurfaceCard>
      ) : null}
    </div>
  );
}
