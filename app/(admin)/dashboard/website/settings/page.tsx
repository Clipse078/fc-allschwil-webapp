import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteConfig } from "@/lib/website/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteSettingsForm from "@/components/admin/website/WebsiteSettingsForm";

export default async function WebsiteSettingsPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const config = await getWebsiteConfig(tenantId).catch(() => null);
  if (!config) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Website-Einstellungen"
        description="Öffentliche Domain, Website-Master-Schalter und Datenschutz-Einstellungen für die Website-Integration konfigurieren."
      />
      <WebsiteSettingsForm defaultValues={config} />
    </div>
  );
}
