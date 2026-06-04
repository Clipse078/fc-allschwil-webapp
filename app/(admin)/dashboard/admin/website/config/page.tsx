import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteConfigForm from "@/components/admin/website/WebsiteConfigForm";
import { getWebsiteConfig } from "@/lib/website/config-queries";

export default async function WebsiteConfigPage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const config = await getWebsiteConfig(tenantId).catch(() => null);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website-Verwaltung"
        title="Website-Einstellungen"
        description="Tagline, Kontaktdaten, Adresse und Social-Media-Links konfigurieren. Diese Daten werden von der öffentlichen Website über /api/public/website/config abgerufen."
      />
      <WebsiteConfigForm initialConfig={config} />
    </div>
  );
}
