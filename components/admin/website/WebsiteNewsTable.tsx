"use client";

import Link from "next/link";
import { useState } from "react";
import { Edit2, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import type { AdminNewsItem } from "@/lib/website/news-queries";

type WebsiteNewsTableProps = {
  initialPosts: AdminNewsItem[];
  canManage: boolean;
};

export default function WebsiteNewsTable({
  initialPosts,
  canManage,
}: WebsiteNewsTableProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTogglePublish(post: AdminNewsItem) {
    if (togglingId) return;
    setTogglingId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/website/news/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !post.isPublished }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Aktualisieren.");
        return;
      }
      const data = await res.json();
      setPosts((current) =>
        current.map((p) => (p.id === post.id ? data.post : p)),
      );
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!confirm("Artikel wirklich löschen?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/website/news/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Löschen.");
        return;
      }
      setPosts((current) => current.filter((p) => p.id !== id));
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          {posts.length} Artikel{posts.length !== 1 ? "" : ""}
        </p>
        {canManage ? (
          <Link
            href="/dashboard/admin/website/news/new"
            className="fca-button-primary flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Neuer Artikel
          </Link>
        ) : null}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--muted)]">
            Noch keine Artikel vorhanden.
          </p>
          {canManage ? (
            <Link
              href="/dashboard/admin/website/news/new"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--blue)] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Ersten Artikel erstellen
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-wider text-slate-500">
                  Titel
                </th>
                <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-wider text-slate-500">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-wider text-slate-500">
                  Publiziert
                </th>
                {canManage ? (
                  <th className="px-4 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-wider text-slate-500">
                    Aktionen
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {post.title}
                    </p>
                    {post.excerpt ? (
                      <p className="mt-0.5 text-[0.72rem] text-slate-500 line-clamp-1">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.72rem] text-slate-600">
                      {post.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    {post.isPublished ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Publiziert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Entwurf
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-slate-500">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(post)}
                          disabled={togglingId === post.id}
                          title={post.isPublished ? "Depublizieren" : "Publizieren"}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        >
                          {post.isPublished ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <Link
                          href={`/dashboard/admin/website/news/${post.id}/edit`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Bearbeiten"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          disabled={deletingId === post.id}
                          title="Löschen"
                          className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
