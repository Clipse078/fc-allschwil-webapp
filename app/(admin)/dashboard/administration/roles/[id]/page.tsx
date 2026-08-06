import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Shield, Users, XCircle } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getTenantPermissionCatalog, getTenantRoleDetail } from "@/lib/roles/tenant-queries";
import RoleScopeBadge from "@/components/admin/roles/RoleScopeBadge";
import ProtectedRoleBadge from "@/components/admin/roles/ProtectedRoleBadge";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import TenantRoleDetailsForm from "@/components/admin/roles/TenantRoleDetailsForm";
import TenantRolePermissionEditor from "@/components/admin/roles/TenantRolePermissionEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantRoleDetailPage({ params }: PageProps) {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_VIEW, tenantId);

  const { id } = await params;
  const [role, moduleGroups] = await Promise.all([
    getTenantRoleDetail(tenantId, id),
    getTenantPermissionCatalog(),
  ]);

  if (!role) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/administration/roles"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--text-2)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Alle Rollen
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--blue-light)]">
              <Shield className="h-6 w-6 text-[var(--blue)]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--blue)]">{role.name}</h3>
              <p className="mt-1 font-mono text-[0.78rem] text-[var(--muted)]">{role.key}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleScopeBadge scope="TENANT" />
            {role.isSystem && <ProtectedRoleBadge />}
            {role.isArchived ? (
              <AdminStatusPill label="Archiviert" tone="muted" />
            ) : (
              <AdminStatusPill label="Aktiv" tone="success" />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-sm font-semibold text-[var(--foreground)]">Rollendetails</p>
            </div>
            <div className="sce-detail-section-body">
              <TenantRoleDetailsForm
                roleId={role.id}
                initialName={role.name}
                initialDescription={role.description}
                isArchived={role.isArchived}
                isSystem={role.isSystem}
              />
            </div>
          </div>

          <div>
            <TenantRolePermissionEditor
              roleId={role.id}
              roleName={role.name}
              isArchived={role.isArchived}
              moduleGroups={moduleGroups}
              initialAssignedKeys={role.permissions.map((p) => p.key)}
              lockedKeys={role.lockedPermissionKeys}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">Zugewiesene Benutzer</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
                {role.assignedUsers.length}
              </span>
            </div>
            <div className="sce-detail-section-body">
              {role.assignedUsers.length === 0 ? (
                <p className="py-4 text-center text-[0.82rem] text-[var(--muted)]">
                  Keine Benutzer zugewiesen.
                </p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {role.assignedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="truncate text-[0.75rem] text-[var(--muted)]">{user.email}</p>
                      </div>
                      {user.membershipIsActive ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Aktives Mitglied" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-label="Inaktive Mitgliedschaft" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/dashboard/administration/roles/assignments"
                className="mt-3 inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-[var(--blue)] hover:underline"
              >
                Zuweisungen verwalten
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
