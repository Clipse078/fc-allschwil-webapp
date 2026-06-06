import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { listAdminNewsArticles } from "@/lib/news/admin-queries";
import AdminPageIntro from "@/components/admin/shared/AdminPageIntro";
import NewsArticleListClient from "@/components/admin/news/NewsArticleListClient";

export default async function WebsiteNewsPage() {
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  const tenant = await getTenantFromSession(session.user.tenantId);
  if (!tenant) {
    return (
      <div className="text-sm text-[var(--muted)]">Tenant nicht gefunden.</div>
    );
  }

  const { articles, total } = await listAdminNewsArticles({
    tenantId: tenant.id,
    limit: 100,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <AdminPageIntro
        eyebrow="Website · News"
        title="News-Artikel"
        description="Erstelle und verwalte Artikel für die öffentliche Website. Nur publizierte Artikel sind für Besucher sichtbar."
      />

      <NewsArticleListClient articles={articles} total={total} />
    </div>
  );
}
