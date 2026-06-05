import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getNewsArticleById } from "@/lib/news/admin-news-queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import NewsArticleForm from "@/components/admin/news/NewsArticleForm";

type PageProps = {
  params: Promise<{ articleId: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

export default async function EditNewsArticlePage({ params, searchParams }: PageProps) {
  const session = await requirePermission(PERMISSIONS.NEWS_MANAGE);
  const tenant = await getTenantFromSession(session.user.tenantId!);
  if (!tenant) notFound();

  const { articleId } = await params;
  const article = await getNewsArticleById(tenant.id, articleId);
  if (!article) notFound();

  const sp = searchParams ? await searchParams : {};
  const justSaved = (sp as { saved?: string }).saved === "1";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/website/news"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
        <AdminSectionHeader
          eyebrow="Website · News"
          title={article.title}
          description={`Slug: ${article.slug}`}
          actions={<NewsStatusBadge status={article.status} />}
        />
      </div>

      {justSaved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Artikel wurde gespeichert.
        </div>
      )}

      <NewsArticleForm article={article} mode="edit" />
    </div>
  );
}
