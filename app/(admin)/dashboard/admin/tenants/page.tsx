import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantRegistryItems } from "@/lib/tenants/platform-ops/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantRegistryList from "@/components/admin/tenants/TenantRegistryList";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function TenantsPage({ searchParams }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.TENANTS_MANAGE);
  const params = await searchParams;

  let tenants: Awaited<ReturnType<typeof getTenantRegistryItems>> = [];
  try {
    tenants = await getTenantRegistryItems("all");
  } catch {
    // DB schema drift or connection failure — render page with empty list
    // so the admin can still navigate and diagnose via /dashboard/runtime.
    tenants = [];
  }

  const initialFilter = params.filter;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Platform"
        title="Tenant Registry"
        description="Operative Tenant-Übersicht mit Lifecycle-Status, Aufmerksamkeitssignalen und Schnellnavigation."
        actions={
          canManage ? (
            <Link href="/dashboard/admin/tenants/new" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neuer Tenant
            </Link>
          ) : undefined
        }
      />

      <TenantRegistryList
        tenants={tenants}
        canManage={canManage}
        initialFilter={initialFilter === "attention" ? "attention" : undefined}
      />
    </div>
  );
}
