"use client";

import { useState, useCallback } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { NewsArticleDetailData } from "@/lib/news/queries";

const LOCALES = [
  { value: "de", label: "Deutsch (de)" },
  { value: "en", label: "English (en)" },
  { value: "fr", label: "Français (fr)" },
  { value: "it", label: "Italiano (it)" },
];

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const inputCls =
  "w-full rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

type NewsArticleFormCardProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  article?: NewsArticleDetailData;
  defaultLocale?: string;
};

export default function NewsArticleFormCard({
  mode,
  action,
  article,
  defaultLocale = "de",
}: NewsArticleFormCardProps) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!slugTouched) setSlug(slugify(value));
    },
    [slugTouched]
  );

  const handleSlugChange = useCallback((value: string) => {
    setSlug(slugify(value));
    setSlugTouched(true);
  }, []);

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && article && (
        <input type="hidden" name="articleId" value={article.id} />
      )}

      <AdminSurfaceCard className="space-y-5 p-6">
        <h3 className="fca-subheading">Metadaten</h3>

        <label className="block space-y-2">
          <span className="fca-label">Titel *</span>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            placeholder="Grossartiger Titel"
            className={inputCls}
          />
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Slug *</span>
          <input
            type="text"
            name="slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
            placeholder="grossartiger-titel"
            className={`${inputCls} font-mono`}
          />
          <p className="text-xs text-slate-400">
            URL: /[tenantKey]/news/{slug || "…"}
          </p>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Sprache</span>
            <select
              name="locale"
              defaultValue={article?.locale ?? defaultLocale}
              className="fca-select"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Autor</span>
            <input
              type="text"
              name="authorName"
              defaultValue={article?.authorName ?? ""}
              placeholder="FC Allschwil"
              className={inputCls}
            />
          </label>
        </div>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="space-y-5 p-6">
        <h3 className="fca-subheading">Texte</h3>

        <label className="block space-y-2">
          <span className="fca-label">Listing-Text (Teaser)</span>
          <textarea
            name="listingText"
            defaultValue={article?.listingText ?? ""}
            rows={3}
            placeholder="Kurze Zusammenfassung für Karten, Infoboards und Benachrichtigungen…"
            className={`${inputCls} resize-y`}
          />
          <p className="text-xs text-slate-400">
            Wird in Übersichtskarten, Infoboards und zukünftigen App-Benachrichtigungen angezeigt.
          </p>
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Inhalt (Body)</span>
          <textarea
            name="body"
            defaultValue={article?.body ?? ""}
            rows={14}
            placeholder="Vollständiger Artikeltext…"
            className={`${inputCls} resize-y`}
          />
        </label>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="space-y-5 p-6">
        <h3 className="fca-subheading">Mediendaten</h3>

        <label className="block space-y-2">
          <span className="fca-label">Cover-Bild URL</span>
          <input
            type="url"
            name="coverImageUrl"
            defaultValue={article?.coverImageUrl ?? ""}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
      </AdminSurfaceCard>

      <div className="flex justify-end">
        <button type="submit" className="fca-button-primary">
          {mode === "create" ? "Artikel erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
