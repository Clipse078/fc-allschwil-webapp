import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_VIEW } from "@/lib/roles/access";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import RoleScopeBadge from "@/components/admin/roles/RoleScopeBadge";
import RolesAdminTabs from "@/components/admin/roles/RolesAdminTabs";

type LayoutProps = { children: ReactNode };

/**
 * Tenant Roles & Permissions module shell (RPERM-05).
 *
 * `tenantId` is resolved server-side from `requireActiveTenantId()` (never a
 * client-submitted value) and passed explicitly into `requireAnyPermission`
 * so this layout — and every page nested under it — is gated by a live
 * `(permission, tenant)` check against `EffectivePermissionResolver`, not
 * the JWT-cached `session.user.permissionKeys` snapshot. A platform Super
 * Admin with no tenant membership never resolves a `tenantId` here and is
 * redirected before any tenant role data is fetched.
 */
export default async function TenantRolesLayout({ children }: LayoutProps) {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_VIEW, tenantId);
  const tenant = await getActiveTenant();

  return (
    <div className="space-y-6 max-w-[1400px]">
      <AdminSectionHeader
        eyebrow="Administration"
        title="Rollen & Berechtigungen"
        description="Mandanten-Rollen, Berechtigungsmatrix, Benutzerzuweisungen und effektiver Zugriff für diesen Mandanten."
        actions={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {tenant?.name ?? "Aktiver Mandant"}
            </span>
            <RoleScopeBadge scope="TENANT" />
          </div>
        }
      />

      <RolesAdminTabs />

      <div>{children}</div>
    </div>
  );
}
