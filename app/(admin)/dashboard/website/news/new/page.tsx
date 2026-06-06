import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewsArticleNewPage() {
  await requireAnyPermission([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website · News"
        title="Neuer Artikel"
        description="Erstelle einen neuen News-Artikel. Er wird als Entwurf gespeichert bis du ihn veröffentlichst."
      />
      <NewsArticleForm />
    </div>
  );
}
