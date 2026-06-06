import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import MediaLibraryGrid from "@/components/admin/media/MediaLibraryGrid";

export default async function MediaLibraryPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="Mediathek"
        description="Bilder und Videos hochladen und verwalten. Medien können in News-Artikeln als Headerbild oder eingebettete Inhalte verwendet werden."
      />
      <MediaLibraryGrid />
    </div>
  );
}
