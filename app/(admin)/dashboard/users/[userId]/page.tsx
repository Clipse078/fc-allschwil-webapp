import Link from "next/link";
import { notFound } from "next/navigation";
import UserForm from "@/components/admin/users/UserForm";
import UserRolesForm from "@/components/admin/users/UserRolesForm";
import ResetPasswordForm from "@/components/admin/users/ResetPasswordForm";
import SendInviteButton from "@/components/admin/users/SendInviteButton";
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

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        description="Verwalte Stammdaten, Rollen, Status, Einladung und Passwort-Reset dieses Benutzers."
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

      <AdminSurfaceCard className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="fca-subheading">Zugangsstatus</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Status:</strong> {user.accessState}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Einladung gesendet:</strong> {formatDateTime(user.invitedAt)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Einladung angenommen:</strong> {formatDateTime(user.inviteAcceptedAt)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Passwort gesetzt:</strong> {formatDateTime(user.passwordSetAt)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Reset-Link gesendet:</strong> {formatDateTime(user.passwordResetSentAt)}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>Letzter Login:</strong> {formatDateTime(user.lastLoginAt)}
              </div>
            </div>
          </div>
        </div>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="fca-subheading">Einladung per E-Mail</h3>
            <p className="mt-3 text-sm text-slate-600">
              Eine Einladung kann erst gesendet werden, nachdem mindestens eine Rolle gespeichert wurde.
            </p>
          </div>

          <SendInviteButton userId={user.id} accessState={user.accessState} />
        </div>
      </AdminSurfaceCard>

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