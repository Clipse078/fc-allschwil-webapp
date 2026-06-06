"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, Globe, ArrowLeft } from "lucide-react";
import Link from "next/link";
import HeroImagePicker from "./HeroImagePicker";
import NewsStatusBadge from "./NewsStatusBadge";
import type { AdminNewsArticleDetail } from "@/lib/news/admin-queries";
import type { MediaAssetListItem } from "@/lib/media/queries";
import type { NewsArticleStatus } from "@prisma/client";

type Props = {
  article?: AdminNewsArticleDetail | null;
  mode: "create" | "edit";
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" }[c] ?? c))
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function NewsArticleForm({ article, mode }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [authorName, setAuthorName] = useState(article?.authorName ?? "");
  const [heroAsset, setHeroAsset] = useState<Pick<
    MediaAssetListItem,
    "id" | "name" | "storagePath" | "altText"
  > | null>(article?.heroMedia ?? null);
  const [heroMediaId, setHeroMediaId] = useState<string | null>(article?.heroMediaId ?? null);
  const [error, setError] = useState<string | null>(null);

  // Phase 9: Channels — Website active, others prep-only (disabled)
  // Stored as JSON array; default WEBSITE only
  const channels = ["WEBSITE"];

  const handleTitleChange = useCallback(
    (v: string) => {
      setTitle(v);
      if (!slugTouched) setSlug(slugify(v));
    },
    [slugTouched],
  );

  const handleHeroSelect = useCallback((asset: MediaAssetListItem | null) => {
    setHeroAsset(asset);
    setHeroMediaId(asset?.id ?? null);
  }, []);

  function handleSave(publish = false) {
    startTransition(async () => {
      setError(null);

      const body = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim(),
        authorName: authorName.trim() || null,
        heroMediaId,
        channels,
      };

      if (!body.title) { setError("Titel ist erforderlich."); return; }
      if (!body.content) { setError("Inhalt ist erforderlich."); return; }

      let res: Response;

      if (mode === "create") {
        res = await fetch("/api/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/news/${article!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }

      const data = await res.json();
      const savedArticle = data.article;

      if (publish) {
        const pubRes = await fetch(`/api/news/${savedArticle.id}/publish`, { method: "POST" });
        if (!pubRes.ok) {
          const pubData = await pubRes.json().catch(() => ({}));
          setError(pubData.error ?? "Publizieren fehlgeschlagen.");
          return;
        }
      }

      router.push("/dashboard/website/news");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard/website/news"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zur Übersicht
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="fca-eyebrow">
            {mode === "create" ? "Neuer Artikel" : "Artikel bearbeiten"}
          </p>
          <h1 className="fca-heading mt-1">
            {mode === "create" ? "Artikel erstellen" : title || "Artikel"}
          </h1>
        </div>
        {article && <NewsStatusBadge status={article.status as NewsArticleStatus} />}
      </div>

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Artikeltitel eingeben…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)] shrink-0">/news/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
                placeholder="artikel-slug"
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              URL-sicherer Bezeichner, eindeutig pro Tenant. Wird automatisch aus dem Titel generiert.
            </p>
          </div>

          {/* Excerpt / Teaser */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Teaser</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Kurze Zusammenfassung des Artikels…"
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] resize-y"
            />
            <p className="text-xs text-[var(--muted)]">
              Wird in der News-Übersicht und für Social Media genutzt.
            </p>
          </div>

          {/* Hero Image */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Hero-Bild</label>
            <HeroImagePicker
              selectedId={heroMediaId}
              selectedAsset={heroAsset}
              onSelect={handleHeroSelect}
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Inhalt (Markdown) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Artikelinhalt in Markdown…&#10;&#10;## Überschrift&#10;&#10;Text hier eingeben…"
              rows={18}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] resize-y"
            />
            <p className="text-xs text-[var(--muted)]">
              Markdown wird vom Website-Frontend gerendert.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Publish actions */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-xs)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Veröffentlichung</h3>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Speichern
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              Speichern & Publizieren
            </button>

            {article?.status === "PUBLISHED" && (
              <p className="text-xs text-[var(--muted)] text-center">
                Artikel ist öffentlich sichtbar
              </p>
            )}
          </div>

          {/* Author */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-xs)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Autor</h3>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="z.B. FC Allschwil Redaktion"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]"
            />
          </div>

          {/* Channels — Phase 9 (prep-only, Website active) */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-xs)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Kanäle</h3>
            <div className="space-y-2">
              {[
                { key: "WEBSITE", label: "Website", active: true },
                { key: "MOBILE_APP", label: "Mobile App", active: false },
                { key: "INFOBOARD", label: "InfoBoard", active: false },
                { key: "NEWSLETTER", label: "Newsletter", active: false },
              ].map((ch) => (
                <label
                  key={ch.key}
                  className={`flex items-center gap-2.5 text-sm ${ch.active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                >
                  <input
                    type="checkbox"
                    checked={ch.key === "WEBSITE"}
                    disabled
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--blue)]"
                  />
                  {ch.label}
                  {!ch.active && (
                    <span className="text-[0.65rem] border border-[var(--border)] px-1.5 py-0.5 rounded-full text-[var(--muted)]">
                      bald
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Article meta */}
          {article && (
            <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-xs)] space-y-2">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Details</h3>
              <div className="space-y-1.5 text-xs text-[var(--muted)]">
                <p>
                  Status: <NewsStatusBadge status={article.status as NewsArticleStatus} />
                </p>
                {article.publishedAt && (
                  <p>
                    Publiziert:{" "}
                    {new Date(article.publishedAt).toLocaleDateString("de-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                )}
                <p>
                  Zuletzt bearbeitet:{" "}
                  {new Date(article.updatedAt).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
