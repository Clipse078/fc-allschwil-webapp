import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import WebsiteNavigationGroupCard from "@/components/admin/navigation/WebsiteNavigationGroupCard";

export default async function WebsiteNavigationPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Navigation"
        description="Hauptnavigation und Footer-Navigation verwalten. Änderungen sind sofort über die öffentliche API verfügbar."
      />

      <div className="space-y-8">
        <WebsiteNavigationGroupCard
          navKey="main"
          title="Hauptnavigation"
          description="Obere Navigationsleiste der Website. Reihenfolge per Pfeil-Buttons ändern."
        />
        <WebsiteNavigationGroupCard
          navKey="footer"
          title="Footer-Navigation"
          description="Links im Seitenfuss der Website."
        />
      </div>
    </div>
  );
}
