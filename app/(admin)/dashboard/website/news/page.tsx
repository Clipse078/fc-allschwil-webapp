import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getNewsArticlesForTenant } from "@/lib/news/admin-queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsArticlesTable from "@/components/admin/news/NewsArticlesTable";

export default async function NewsOverviewPage() {
  const session = await requireAnyPermission([PERMISSIONS.NEWS_MANAGE]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const tenant = await getTenantFromSession(tenantId);
  if (!tenant) notFound();

  const articles = await getNewsArticlesForTenant(tenantId);

  const published = articles.filter((a) => a.status === "PUBLISHED").length;
  const drafts = articles.filter((a) => a.status === "DRAFT").length;
  const archived = articles.filter((a) => a.status === "ARCHIVED").length;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="News"
        description="Veröffentliche Neuigkeiten, Ankündigungen und Berichte. Artikel im Status Entwurf sind nur intern sichtbar."
        actions={
          <Link
            href="/dashboard/website/news/new"
            className="fca-button-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neuer Artikel
          </Link>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="fca-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{published}</p>
          <p className="text-xs font-medium text-[var(--text-2)] mt-1">Veröffentlicht</p>
        </div>
        <div className="fca-card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{drafts}</p>
          <p className="text-xs font-medium text-[var(--text-2)] mt-1">Entwürfe</p>
        </div>
        <div className="fca-card p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{archived}</p>
          <p className="text-xs font-medium text-[var(--text-2)] mt-1">Archiviert</p>
        </div>
      </div>

      <NewsArticlesTable articles={articles} tenantKey={tenant.key} />
    </div>
  );
}
