"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Newspaper, PenLine, Plus, Eye, EyeOff, Trash2, RefreshCw } from "lucide-react";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import type { ArticleStatus, NewsArticleAdminListItem } from "@/lib/news/admin-queries";
import { SectionCard, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui";

type FilterStatus = "ALL" | ArticleStatus;

function formatDate(d: Date | null): string {
  if (!d) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "Alle", value: "ALL" },
  { label: "Entwurf", value: "DRAFT" },
  { label: "In Prüfung", value: "IN_REVIEW" },
  { label: "Geplant", value: "SCHEDULED" },
  { label: "Veröffentlicht", value: "PUBLISHED" },
  { label: "Archiviert", value: "ARCHIVED" },
];

export default function NewsArticleList() {
  const [articles, setArticles] = useState<NewsArticleAdminListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setArticles(data.articles ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish(id: string, currentStatus: ArticleStatus) {
    setActionPending(id);
    try {
      const action = currentStatus === "PUBLISHED" ? "?action=unpublish" : "";
      const res = await fetch(`/api/news/${id}/publish${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setArticles((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: data.article.status, publishedAt: data.article.publishedAt }
            : a,
        ),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Artikel wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(`/api/news/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setActionPending(null);
    }
  }

  return (
    <SectionCard noPadding>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 transition ${
                filter === f.value
                  ? "bg-[var(--surface)] shadow-sm text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="icon"
          onClick={load}
          disabled={loading}
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Content: skeleton → empty → table */}
      {loading && articles.length === 0 ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-10 w-10" />}
          heading="Keine Artikel vorhanden"
          description="Erstelle den ersten News-Artikel für deine Website."
          action={
            <Link href="/dashboard/website/news/new" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Ersten Artikel erstellen
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Titel
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Veröffentlicht
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Geändert
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {articles.map((article) => (
                <tr
                  key={article.id}
                  className="bg-[var(--surface)] transition hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="line-clamp-1 font-medium text-[var(--foreground)]">
                        {article.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">{article.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <NewsStatusBadge status={article.status} />
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--muted)]">
                    {formatDate(article.publishedAt)}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--muted)]">
                    {formatDate(article.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/website/news/${article.id}/edit`}
                        className="sce-icon-button"
                        title="Bearbeiten"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </Link>
                      {/* Only show publish toggle for non-review statuses */}
                      {article.status !== "IN_REVIEW" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(article.id, article.status)}
                          disabled={actionPending === article.id}
                          className="sce-icon-button"
                          title={
                            article.status === "PUBLISHED"
                              ? "Depublizieren"
                              : "Veröffentlichen"
                          }
                        >
                          {article.status === "PUBLISHED" ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(article.id)}
                        disabled={actionPending === article.id}
                        className="sce-icon-button text-rose-500 hover:text-rose-700"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!loading && total > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[11px] text-[var(--muted)]">
            {articles.length} von {total} Artikeln geladen
          </p>
        </div>
      )}
    </SectionCard>
  );
}
