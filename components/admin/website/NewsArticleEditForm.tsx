"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { updateNewsArticle, setArticleStatus, type UpdateResult } from "@/app/(admin)/dashboard/website/news/[articleId]/actions";

type ArticleData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  listingText: string | null;
  body: string | null;
  coverImageUrl: string | null;
  locale: string;
  status: string;
};

type Props = { article: ArticleData };

const LOCALES = ["de", "fr", "it", "en"] as const;
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-600",
};
const STATUS_LABELS: Record<string, string> = { DRAFT: "Entwurf", REVIEW: "In Prüfung", PUBLISHED: "Publiziert", ARCHIVED: "Archiviert" };

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export default function NewsArticleEditForm({ article }: Props) {
  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugEdited, setSlugEdited] = useState(false);
  const [excerpt, setExcerpt] = useState(article.excerpt ?? "");
  const [listingText, setListingText] = useState(article.listingText ?? "");
  const [body, setBody] = useState(article.body ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(article.coverImageUrl ?? "");
  const [locale, setLocale] = useState(article.locale);
  const [status, setStatus] = useState(article.status);

  const [saveResult, setSaveResult] = useState<UpdateResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isStatusPending, startStatusTransition] = useTransition();

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
    setSaveResult(null);
  }

  function handleSave() {
    setSaveResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", article.id);
      fd.append("title", title);
      fd.append("slug", slug);
      fd.append("excerpt", excerpt);
      fd.append("listingText", listingText);
      fd.append("body", body);
      fd.append("coverImageUrl", coverImageUrl);
      fd.append("locale", locale);
      const result = await updateNewsArticle(fd);
      setSaveResult(result);
    });
  }

  function handleSetStatus(newStatus: string) {
    startStatusTransition(async () => {
      const fd = new FormData();
      fd.append("id", article.id);
      fd.append("status", newStatus);
      const result = await setArticleStatus(fd);
      if (result.ok) setStatus(newStatus);
    });
  }

  const base = "w-full rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_300px]">
      {/* Main content */}
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-[14px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
          <p className="text-[12px] text-slate-600">
            Starke News-Beiträge halten die Website lebendig. Nutze einen klaren Titel, kurze Einleitung und ein starkes Bild.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-500">Titel</label>
          <input className={`mt-1.5 h-10 ${base}`} value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Artikeltitel" required />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-500">
            Listing-Text{" "}
            <span className="font-normal text-slate-400">(Teaser auf Homepage, App, Infoboard)</span>
          </label>
          <textarea rows={2} className={`mt-1.5 resize-none py-2 ${base}`} value={listingText} onChange={(e) => { setListingText(e.target.value); setSaveResult(null); }} placeholder="Ein Satz der schnell erklärt warum dieser Artikel wichtig ist." />
          <p className="mt-1 text-[10px] text-slate-400">
            Priorität: Listing-Text → Einleitung → Artikeltext. Wird auf Homepage-Karten und Teasern verwendet.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-500">Einleitung (excerpt)</label>
          <textarea rows={2} className={`mt-1.5 resize-none py-2 ${base}`} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); setSaveResult(null); }} placeholder="Kurze Zusammenfassung des Artikels (2–3 Sätze)." />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-500">Artikeltext</label>
          <textarea rows={12} className={`mt-1.5 resize-y py-2 font-mono text-[13px] ${base}`} value={body} onChange={(e) => { setBody(e.target.value); setSaveResult(null); }} placeholder="Vollständiger Artikeltext (Markdown oder Fliesstext)." />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-500">Cover-Bild URL</label>
          <input className={`mt-1.5 h-9 ${base}`} value={coverImageUrl} onChange={(e) => { setCoverImageUrl(e.target.value); setSaveResult(null); }} placeholder="https://..." />
        </div>

        {/* Save feedback */}
        {saveResult?.ok && (
          <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[12px] text-emerald-800">Gespeichert.</p>
          </div>
        )}
        {saveResult && !saveResult.ok && (
          <p className="text-[12px] text-rose-600">{saveResult.error}</p>
        )}

        <button type="button" onClick={handleSave} disabled={isPending} className="rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50">
          {isPending ? "Speichern …" : "Änderungen speichern"}
        </button>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Status */}
        <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Status</p>
          <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {status !== "PUBLISHED" && (
              <button type="button" onClick={() => handleSetStatus("PUBLISHED")} disabled={isStatusPending} className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                Publizieren
              </button>
            )}
            {status !== "DRAFT" && status !== "ARCHIVED" && (
              <button type="button" onClick={() => handleSetStatus("DRAFT")} disabled={isStatusPending} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Zurück zu Entwurf
              </button>
            )}
            {status !== "ARCHIVED" && (
              <button type="button" onClick={() => handleSetStatus("ARCHIVED")} disabled={isStatusPending} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                Archivieren
              </button>
            )}
          </div>
        </div>

        {/* Slug + locale */}
        <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Sprache</label>
            <select className={`mt-1 h-9 ${base}`} value={locale} onChange={(e) => { setLocale(e.target.value); setSaveResult(null); }}>
              {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Slug</label>
            <div className="mt-1 flex items-center rounded-[12px] border border-slate-200 focus-within:border-[#0b4aa2]">
              <span className="pl-3 text-sm text-slate-400">/</span>
              <input className="h-9 flex-1 bg-transparent px-2 text-sm text-slate-900 outline-none" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); setSaveResult(null); }} />
            </div>
          </div>
        </div>

        {/* Cover preview */}
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="Cover" className="h-32 w-full rounded-[14px] object-cover" />
        )}
      </div>
    </div>
  );
}
