import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import HomepageBlockList from "@/components/admin/homepage-blocks/HomepageBlockList";

export default async function HomepageBlocksPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Homepage"
        description="Composable Homepage-Blöcke erstellen, bearbeiten und veröffentlichen. Nur veröffentlichte Blöcke werden in der öffentlichen API angezeigt."
      />
      <HomepageBlockList />
    </div>
  );
}
