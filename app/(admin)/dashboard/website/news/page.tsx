import Link from "next/link";
import { Plus, Pencil, Globe, FileText } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { listNewsArticles } from "@/lib/news/admin-news-queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import type { NewsArticleStatus } from "@prisma/client";

const STATUS_FILTERS: { label: string; value: string | null }[] = [
  { label: "Alle", value: null },
  { label: "Entwürfe", value: "DRAFT" },
  { label: "In Prüfung", value: "IN_REVIEW" },
  { label: "Freigegeben", value: "APPROVED" },
  { label: "Veröffentlicht", value: "PUBLISHED" },
  { label: "Archiviert", value: "ARCHIVED" },
];

const VALID_STATUSES: NewsArticleStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];
function isValidStatus(s: unknown): s is NewsArticleStatus {
  return typeof s === "string" && (VALID_STATUSES as string[]).includes(s);
}

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function WebsiteNewsPage({ searchParams }: PageProps) {
  const session = await requirePermission(PERMISSIONS.NEWS_MANAGE);
  const tenant = await getTenantFromSession(session.user.tenantId!);
  if (!tenant) return null;

  const params = searchParams ? await searchParams : {};
  const rawStatus = (params as { status?: string }).status;
  const activeStatus = isValidStatus(rawStatus) ? rawStatus : null;

  const articles = await listNewsArticles({
    tenantId: tenant.id,
    status: activeStatus,
  });

  const publishedCount = articles.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = articles.filter((a) => a.status === "DRAFT").length;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Website"
        title="News"
        description="News-Artikel erstellen, bearbeiten und auf der Website veröffentlichen."
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Gesamt</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{articles.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Veröffentlicht</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{publishedCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entwürfe</p>
          <p className="mt-1 text-3xl font-bold text-zinc-700">{draftCount}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const isActive = f.value === activeStatus;
          const href =
            f.value
              ? `/dashboard/website/news?status=${f.value}`
              : "/dashboard/website/news";
          return (
            <Link
              key={f.value ?? "all"}
              href={href}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Articles table */}
      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium text-zinc-500">Keine Artikel gefunden.</p>
          <Link
            href="/dashboard/website/news/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-900 underline underline-offset-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Ersten Artikel erstellen
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">Titel</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 sm:table-cell">Autor</th>
                <th className="hidden px-4 py-3 md:table-cell">Erstellt</th>
                <th className="hidden px-4 py-3 lg:table-cell">Veröffentlicht</th>
                <th className="px-4 py-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {articles.map((article) => (
                <tr key={article.id} className="group hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-zinc-900 group-hover:text-black">
                        {article.title}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-400">{article.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <NewsStatusBadge status={article.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">
                    {article.authorName ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 md:table-cell">
                    {new Date(article.createdAt).toLocaleDateString("de-CH")}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 lg:table-cell">
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString("de-CH")
                      : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {article.status === "PUBLISHED" && (
                        <span
                          className="text-emerald-500"
                          title="Veröffentlicht"
                        >
                          <Globe className="h-4 w-4" />
                        </span>
                      )}
                      <Link
                        href={`/dashboard/website/news/${article.id}/edit`}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Bearbeiten
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
