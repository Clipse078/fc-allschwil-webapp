import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteStatusSummary } from "@/lib/website/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteDashboardPanel from "@/components/admin/website/WebsiteDashboardPanel";

export default async function WebsitePage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const summary = await getWebsiteStatusSummary(tenantId).catch(() => null);
  if (!summary) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Website-Übersicht"
        description="Publikationsstatus der öffentlichen Website. Sektionen verwalten, Inhalte freigeben und Website-Integration konfigurieren."
      />
      <WebsiteDashboardPanel summary={summary} />
    </div>
  );
}
