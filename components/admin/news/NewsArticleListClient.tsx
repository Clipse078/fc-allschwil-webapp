"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Edit2, Globe, Archive, Plus, Search, Filter } from "lucide-react";
import NewsStatusBadge from "./NewsStatusBadge";
import type { AdminNewsArticleListItem } from "@/lib/news/admin-queries";
import type { NewsArticleStatus } from "@prisma/client";

type Props = {
  articles: AdminNewsArticleListItem[];
  total: number;
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "DRAFT", label: "Entwurf" },
  { value: "REVIEW", label: "Review" },
  { value: "APPROVED", label: "Genehmigt" },
  { value: "PUBLISHED", label: "Publiziert" },
  { value: "ARCHIVED", label: "Archiviert" },
];

export default function NewsArticleListClient({ articles, total }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = articles
    .filter((a) => !selectedStatus || a.status === selectedStatus)
    .filter(
      (a) =>
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.slug.toLowerCase().includes(search.toLowerCase()),
    );

  function handlePublish(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/news/${id}/publish`, { method: "POST" });
      if (res.ok) router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/news/${id}/archive`, { method: "POST" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] w-48"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-sm border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] appearance-none"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Link
          href="/dashboard/website/news/new"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--blue)] px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Neuer Artikel
        </Link>
      </div>

      {/* Count */}
      <p className="text-xs text-[var(--muted)]">
        {filtered.length} von {total} Artikeln
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <p className="text-sm text-[var(--muted)]">Keine Artikel gefunden.</p>
          <Link
            href="/dashboard/website/news/new"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--blue)] hover:underline"
          >
            <Plus className="h-4 w-4" />
            Ersten Artikel erstellen
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)]">
          {filtered.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              onPublish={() => handlePublish(article.id)}
              onArchive={() => handleArchive(article.id)}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  onPublish,
  onArchive,
  isPending,
}: {
  article: AdminNewsArticleListItem;
  onPublish: () => void;
  onArchive: () => void;
  isPending: boolean;
}) {
  const canPublish = article.status === "DRAFT" || article.status === "REVIEW" || article.status === "APPROVED";
  const canArchive = article.status !== "ARCHIVED";

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      {/* Hero thumbnail */}
      {article.heroMedia?.storagePath ? (
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--background)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.heroMedia.storagePath}
            alt={article.heroMedia.altText ?? article.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-14 w-20 shrink-0 rounded-[var(--radius-md)] bg-[var(--background)] flex items-center justify-center">
          <span className="text-[var(--muted)] text-xs">Kein Bild</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
              {article.title}
            </h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              /{article.slug}
              {article.authorName && ` · ${article.authorName}`}
            </p>
          </div>
          <NewsStatusBadge status={article.status as NewsArticleStatus} />
        </div>
        {article.excerpt && (
          <p className="mt-1.5 text-xs text-[var(--text-2)] line-clamp-2 max-w-lg">
            {article.excerpt}
          </p>
        )}
        <p className="mt-1.5 text-[0.68rem] text-[var(--muted)]">
          {article.publishedAt
            ? `Publiziert ${formatDistanceToNow(new Date(article.publishedAt), { locale: de, addSuffix: true })}`
            : `Zuletzt geändert ${formatDistanceToNow(new Date(article.updatedAt), { locale: de, addSuffix: true })}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/dashboard/website/news/${article.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Bearbeiten
        </Link>

        {canPublish && (
          <button
            onClick={onPublish}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--blue)] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            Publizieren
          </button>
        )}

        {canArchive && (
          <button
            onClick={onArchive}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            title="Archivieren"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
