import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleList from "@/components/admin/news/NewsArticleList";

export default async function NewsAdminPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="News-Artikel"
        description="News-Artikel erstellen, bearbeiten und veröffentlichen. Veröffentlichte Artikel erscheinen im öffentlichen News-Feed der Website."
      />
      <NewsArticleList />
    </div>
  );
}
