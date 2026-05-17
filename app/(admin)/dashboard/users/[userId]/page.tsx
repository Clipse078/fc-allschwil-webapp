import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
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
import { getUserTenantCount } from "@/lib/tenants/user-tenant-queries";

type UserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const canImpersonate = hasPermission(session, PERMISSIONS.USERS_IMPERSONATE);
  const isSuperAdmin = (session.user.roleKeys ?? []).includes("super_admin");

  const { userId } = await params;
  const user = await getUserDetailData(userId);

  if (!user) {
    notFound();
  }

  const [roles, tenantCount] = await Promise.all([
    getRolesListData(),
    isSuperAdmin ? getUserTenantCount(userId).catch(() => null) : Promise.resolve(null),
  ]);
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
            {isSuperAdmin ? (
              <Link
                href={`/dashboard/users/${userId}/tenants`}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
              >
                <Building2 className="h-4 w-4" />
                Tenant Access
                {tenantCount !== null ? (
                  <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                    {tenantCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
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

      {isSuperAdmin ? (
        <AdminSurfaceCard className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900">Tenant Access</h3>
                {tenantCount !== null ? (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {tenantCount} {tenantCount === 1 ? "club" : "clubs"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Manage which clubs this user can access in SportClubEvo.
              </p>
            </div>
            <Link
              href={`/dashboard/users/${userId}/tenants`}
              className="fca-button-secondary shrink-0 text-sm"
            >
              Manage Access →
            </Link>
          </div>
        </AdminSurfaceCard>
      ) : null}
    </div>
  );
}
