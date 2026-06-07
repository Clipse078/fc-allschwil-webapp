import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsitePageList from "@/components/admin/pages/WebsitePageList";

export default async function WebsitePagesAdminPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Seiten"
        description="Statische Website-Seiten erstellen, bearbeiten und veröffentlichen. Veröffentlichte Seiten sind über die öffentliche API abrufbar."
      />
      <WebsitePageList />
    </div>
  );
}
