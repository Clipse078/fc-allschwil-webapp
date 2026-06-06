import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewNewsArticlePage() {
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website · News"
        title="Neuer Artikel"
        description="Erstelle einen neuen News-Artikel. Er wird als Entwurf gespeichert und kann anschliessend veröffentlicht werden."
      />
      <NewsArticleForm mode="create" />
    </div>
  );
}
