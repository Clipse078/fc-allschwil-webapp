import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

export default async function NewsArticleNewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const ctx = await getTenantContextFromSession(tenantId);
  if (!ctx) notFound();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website · News"
        title="Neuer Artikel"
        description="Erstelle einen neuen News-Artikel. Er wird als Entwurf gespeichert bis du ihn veröffentlichst."
      />
      <NewsArticleForm requiresReview={ctx.approvedDataOnly} />
    </div>
  );
}
