"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PenLine, Plus, Eye, EyeOff, Trash2, RefreshCw } from "lucide-react";
import NewsStatusBadge from "@/components/admin/news/NewsStatusBadge";
import type { ArticleStatus, NewsArticleAdminListItem } from "@/lib/news/admin-queries";

type FilterStatus = "ALL" | ArticleStatus;

function formatDate(d: Date | null): string {
  if (!d) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

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

  const filters: { label: string; value: FilterStatus }[] = [
    { label: "Alle", value: "ALL" },
    { label: "Entwurf", value: "DRAFT" },
    { label: "In Prüfung", value: "IN_REVIEW" },
    { label: "Geplant", value: "SCHEDULED" },
    { label: "Veröffentlicht", value: "PUBLISHED" },
    { label: "Archiviert", value: "ARCHIVED" },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
          {filters.map((f) => (
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="fca-button-secondary px-2.5"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/dashboard/website/news/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neuer Artikel
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading && articles.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[var(--muted)]">
          <p className="text-sm">Keine Artikel vorhanden.</p>
          <Link href="/dashboard/website/news/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Ersten Artikel erstellen
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)]">
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
                      <p className="font-medium text-[var(--foreground)] line-clamp-1">
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

      {!loading && total > 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          {articles.length} von {total} Artikeln geladen
        </p>
      )}
    </div>
  );
}
