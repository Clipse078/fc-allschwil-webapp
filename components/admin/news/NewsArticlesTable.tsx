"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Plus, Eye, EyeOff, Archive, Trash2, Pencil } from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import type { AdminNewsArticleListItem } from "@/lib/news/admin-queries";

type Props = {
  articles: AdminNewsArticleListItem[];
  tenantKey: string;
};

function statusTone(
  status: string,
): "default" | "success" | "muted" | "warning" {
  if (status === "PUBLISHED") return "success";
  if (status === "ARCHIVED") return "muted";
  return "default";
}

function statusLabel(status: string): string {
  if (status === "PUBLISHED") return "Veröffentlicht";
  if (status === "ARCHIVED") return "Archiviert";
  return "Entwurf";
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default function NewsArticlesTable({ articles, tenantKey }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doAction(articleId: string, path: string, method: string) {
    setBusy(articleId + path);
    setError(null);
    try {
      const res = await fetch(`/api/news/${articleId}/${path}`, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehler beim Ausführen der Aktion.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  async function handleDelete(articleId: string) {
    if (!confirm("Artikel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."))
      return;
    setBusy(articleId + "delete");
    setError(null);
    try {
      const res = await fetch(`/api/news/${articleId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehler beim Löschen.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <FileText className="h-10 w-10 text-[var(--muted)]" />
        <div>
          <p className="fca-body font-medium">Keine Artikel vorhanden</p>
          <p className="fca-body-muted mt-1">
            Erstelle deinen ersten News-Artikel.
          </p>
        </div>
        <Link href="/dashboard/website/news/new" className="fca-button-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Neuer Artikel
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Titel</th>
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Slug</th>
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Status</th>
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Veröffentlicht</th>
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Geändert</th>
              <th className="px-5 py-3.5 font-semibold text-[var(--text-2)]">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {articles.map((article) => (
              <tr key={article.id} className="hover:bg-[var(--surface-2)] transition-colors">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/dashboard/website/news/${article.id}`}
                    className="font-medium text-[var(--foreground)] hover:text-[var(--tenant-primary)] transition-colors"
                  >
                    {article.title}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-2)]">
                    {article.slug}
                  </code>
                </td>
                <td className="px-5 py-3.5">
                  <AdminStatusPill
                    label={statusLabel(article.status)}
                    tone={statusTone(article.status)}
                  />
                </td>
                <td className="px-5 py-3.5 text-[var(--text-2)]">
                  {formatDate(article.publishedAt)}
                </td>
                <td className="px-5 py-3.5 text-[var(--text-2)]">
                  {formatDate(article.updatedAt)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/website/news/${article.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="h-3 w-3" />
                    </Link>

                    {article.status !== "PUBLISHED" && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => doAction(article.id, "publish", "POST")}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        title="Veröffentlichen"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}

                    {article.status === "PUBLISHED" && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => doAction(article.id, "unpublish", "POST")}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        title="Depublizieren"
                      >
                        <EyeOff className="h-3 w-3" />
                      </button>
                    )}

                    {article.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => doAction(article.id, "archive", "POST")}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                        title="Archivieren"
                      >
                        <Archive className="h-3 w-3" />
                      </button>
                    )}

                    {article.status !== "PUBLISHED" && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => handleDelete(article.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tenantKey && (
        <p className="text-xs text-[var(--muted)]">
          Öffentlicher Feed:{" "}
          <a
            href="/api/public/v1/website/news"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[var(--tenant-primary)]"
          >
            /api/public/v1/website/news
          </a>
        </p>
      )}
    </div>
  );
}
