"use client";

import Link from "next/link";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { NewsArticleListItem } from "@/lib/news/queries";

type NewsArticlesTableProps = {
  articles: NewsArticleListItem[];
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function NewsArticlesTable({ articles }: NewsArticlesTableProps) {
  if (articles.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="text-sm text-slate-500">
          Noch keine Artikel vorhanden. Erstelle den ersten Artikel.
        </p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <AdminListItem
          key={article.id}
          avatar={
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.08em] text-[#0b4aa2] shadow-sm">
              {article.locale.toUpperCase()}
            </div>
          }
          title={article.title}
          subtitle={`/${article.slug} · ${formatDate(article.publishedAt)}`}
          meta={
            <>
              <AdminStatusPill
                label={article.status === "PUBLISHED" ? "Publiziert" : "Entwurf"}
                tone={article.status === "PUBLISHED" ? "success" : "muted"}
              />
              <span className="fca-pill">{article.locale}</span>
            </>
          }
          actions={
            <Link
              href={`/dashboard/website/news/${article.id}`}
              className="fca-button-primary"
            >
              Bearbeiten
            </Link>
          }
        />
      ))}
    </div>
  );
}
