import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PublishingCenter from "@/components/admin/publishing/PublishingCenter";

export default async function PublishingCenterPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Veröffentlichungen"
        description="Zentrales Cockpit für alle veröffentlichbaren Website-Inhalte. News-Artikel und Seiten auf einen Blick verwalten, prüfen und veröffentlichen."
      />
      <PublishingCenter />
    </div>
  );
}
