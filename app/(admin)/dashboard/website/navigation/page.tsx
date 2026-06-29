import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import { listNavItemsGrouped, countNavItems } from "@/lib/navigation/admin-queries";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import NavigationManager from "@/components/admin/navigation/NavigationManager";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";
import { notFound } from "next/navigation";

export default async function NavigationManagementPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const [areas, total] = await Promise.all([
    listNavItemsGrouped(tenantId),
    countNavItems(tenantId),
  ]);

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Navigation Builder" },
        ]}
      />

      <PageHeader
        eyebrow="Website"
        title="Navigation Builder"
        description="Visueller Navigation Builder: Drag & Drop, Inspector-Panel, Mega-Menü, Zeitplanung und Live-Vorschau."
        className="mb-6"
      />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm" style={{ height: "calc(100vh - 260px)", minHeight: 500 }}>
        <NavigationManager initialData={{ areas, meta: { total } }} />
      </div>
    </PageShell>
  );
}
